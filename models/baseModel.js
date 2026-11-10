/**
 * Adapter tipis: API gaya Mongoose di atas Supabase (PostgreSQL).
 *
 * Tujuannya supaya controller & view yang sudah ada tetap jalan tanpa diubah:
 *   - dokumen punya `_id`, `createdAt`, `updatedAt` (camelCase) seperti sebelumnya
 *   - find / findOne / findById / create / save / populate / sort / limit / lean
 *   - findByIdAndUpdate / findOneAndUpdate ($set, $inc, $pull, $setOnInsert, upsert)
 *   - exists / countDocuments / updateMany / findByIdAndDelete
 *
 * Konvensi:
 *   - kolom di Postgres snake_case (phone_number), field di JS camelCase (phoneNumber)
 *   - relasi (ref) disimpan sebagai kolom FK (user_id), di JS tetap `user`
 *   - array embedded (order.items, cart.items, wishlist.products) disimpan sebagai jsonb
 */
const { getSupabase } = require('../config/supabase');

const PAGE_SIZE = 1000; // batas default PostgREST per request
const ID_CHUNK = 100;

const toSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const fail = (error) => {
  const err = new Error(error.message || 'Supabase error');
  err.code = error.code;
  err.details = error.details;
  err.hint = error.hint;
  throw err;
};

const idOf = (value) =>
  value && typeof value === 'object' && !(value instanceof Date)
    ? (value._id ?? value.id ?? null)
    : (value ?? null);

const isPlainValue = (v) => v === null || typeof v !== 'object' || v instanceof Date;

function toPlain(value) {
  if (Array.isArray(value)) return value.map(toPlain);
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
  return out;
}

// ---------------------------------------------------------------------------
// Dokumen
// ---------------------------------------------------------------------------
class Doc {
  constructor(ctx, data) {
    Object.defineProperty(this, '_ctx', { value: ctx });
    Object.defineProperty(this, '_snap', { value: {}, writable: true });
    Object.assign(this, data);
  }

  get id() {
    return this._id;
  }

  toObject() {
    return toPlain(this);
  }

  async populate(path, select) {
    await populate(this._ctx, this, { path, select });
    return this;
  }

  // Hanya kolom yang berubah yang dikirim ke database.
  async save() {
    const ctx = this._ctx;
    const row = ctx.toRow(this);
    const changed = {};

    for (const [col, value] of Object.entries(row)) {
      if (JSON.stringify(value) !== this._snap[col]) changed[col] = value;
    }

    if (!Object.keys(changed).length) return this;

    const { data, error } = await getSupabase()
      .from(ctx.table)
      .update(changed)
      .eq('id', this._id)
      .select('updated_at')
      .maybeSingle();

    if (error) fail(error);
    if (!data) throw new Error(`${ctx.name} dengan id ${this._id} tidak ditemukan`);

    this.updatedAt = new Date(data.updated_at);
    for (const [col, value] of Object.entries(changed)) {
      this._snap[col] = JSON.stringify(value);
    }

    return this;
  }
}

// ---------------------------------------------------------------------------
// Query (thenable, bisa di-chain: .populate().sort().limit().lean())
// ---------------------------------------------------------------------------
class Query {
  constructor(ctx, run) {
    this._ctx = ctx;
    this._run = run;
    this._populate = [];
    this._sort = null;
    this._limit = null;
    this._lean = false;
  }

  populate(path, select) {
    this._populate.push({ path, select });
    return this;
  }

  sort(spec) {
    this._sort = spec;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  lean() {
    this._lean = true;
    return this;
  }

  async exec() {
    let result = await this._run(this);
    for (const p of this._populate) await populate(this._ctx, result, p);
    if (this._lean) result = toPlain(result);
    return result;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

// ---------------------------------------------------------------------------
// Populate
// ---------------------------------------------------------------------------
async function populate(ctx, result, { path, select }) {
  const docs = (Array.isArray(result) ? result : [result]).filter(Boolean);
  if (!docs.length) return;

  const isRef = Boolean(ctx.refs[path]);
  const spec = ctx.refs[path] || ctx.embedded[path];
  if (!spec) throw new Error(`populate('${path}') tidak dikenal di model ${ctx.name}`);

  const target = spec.model()._ctx;
  const [arrKey, subKey] = !isRef && path.includes('.') ? path.split('.') : [path, null];

  // "slot" = satu tempat yang berisi id (atau daftar id) yang harus diganti dokumen
  const slots = [];
  for (const doc of docs) {
    if (isRef) {
      slots.push({ get: () => doc[path], set: (v) => (doc[path] = v) });
    } else if (subKey) {
      for (const item of doc[arrKey] || []) {
        slots.push({ get: () => item?.[subKey], set: (v) => (item[subKey] = v) });
      }
    } else if (Array.isArray(doc[path])) {
      slots.push({ list: true, get: () => doc[path], set: (v) => (doc[path] = v) });
    }
  }

  const ids = new Set();
  for (const slot of slots) {
    const values = slot.list ? slot.get() : [slot.get()];
    for (const v of values) if (typeof v === 'string') ids.add(v);
  }

  const found = new Map();
  if (ids.size) {
    const columns = select
      ? [
          ...new Set([
            'id',
            ...select
              .split(/\s+/)
              .filter(Boolean)
              .map((f) => target.colFor(f)),
          ]),
        ].join(',')
      : '*';

    const all = [...ids];
    for (let i = 0; i < all.length; i += ID_CHUNK) {
      const { data, error } = await getSupabase()
        .from(target.table)
        .select(columns)
        .in('id', all.slice(i, i + ID_CHUNK));
      if (error) fail(error);
      for (const row of data) found.set(row.id, target.hydrate(row));
    }
  }

  for (const slot of slots) {
    if (slot.list) {
      slot.set(slot.get().map((v) => (typeof v === 'string' ? (found.get(v) ?? null) : v)).filter(Boolean));
    } else if (typeof slot.get() === 'string') {
      slot.set(found.get(slot.get()) ?? null);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory model
// ---------------------------------------------------------------------------
function createModel(config) {
  const {
    name,
    table,
    refs = {}, // { user: { column: 'user_id', model: () => require('./UserModel') } }
    embedded = {}, // { 'items.product': { model } }  atau  { products: { model } }
    dates = [], // field Date selain createdAt/updatedAt
    trim = [],
    lowercase = [],
    afterLoad = null,
  } = config;

  const refColumns = Object.fromEntries(Object.entries(refs).map(([key, r]) => [r.column, key]));
  const dateFields = new Set(['createdAt', 'updatedAt', ...dates]);
  const trimFields = new Set(trim);
  const lowerFields = new Set(lowercase);

  const ctx = { name, table, refs, embedded };

  ctx.colFor = (key) => {
    if (key === '_id') return 'id';
    if (refs[key]) return refs[key].column;
    return toSnake(key);
  };

  // ---- row <-> dokumen ----
  const serialize = (key, value) => {
    if (refs[key]) return idOf(value);

    let v = value;
    if (typeof v === 'string') {
      if (trimFields.has(key)) v = v.trim();
      if (lowerFields.has(key)) v = v.toLowerCase();
    }

    // dokumen hasil populate di dalam array embedded dikembalikan jadi id
    for (const path of Object.keys(embedded)) {
      const [arrKey, subKey] = path.split('.');
      if (key !== arrKey || !Array.isArray(v)) continue;
      v = subKey
        ? v.map((item) =>
            item && typeof item === 'object'
              ? { ...toPlainShallow(item), [subKey]: idOf(item[subKey]) }
              : item,
          )
        : v.map(idOf);
    }

    return v;
  };

  const toPlainShallow = (item) => ({ ...item });

  ctx.toRow = (data) => {
    const row = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (key === '_id' || key === 'createdAt' || key === 'updatedAt') continue;
      row[ctx.colFor(key)] = serialize(key, value);
    }
    return row;
  };

  ctx.hydrate = (row) => {
    const data = {};
    for (const [col, value] of Object.entries(row)) {
      if (col === 'id') {
        data._id = value;
      } else if (refColumns[col]) {
        data[refColumns[col]] = value;
      } else {
        const key = toCamel(col);
        data[key] = dateFields.has(key) && value != null ? new Date(value) : value;
      }
    }

    const doc = new Doc(ctx, data);
    if (afterLoad) afterLoad(doc);

    const snap = {};
    for (const [col, value] of Object.entries(ctx.toRow(doc))) snap[col] = JSON.stringify(value);
    doc._snap = snap;

    return doc;
  };

  // ---- filter -> query builder Supabase ----
  const quote = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

  const orClause = (clause) => {
    const parts = Object.entries(clause).map(([k, v]) =>
      v === null ? `${ctx.colFor(k)}.is.null` : `${ctx.colFor(k)}.eq.${quote(v)}`,
    );
    return parts.length === 1 ? parts[0] : `and(${parts.join(',')})`;
  };

  const applyFilter = (q, filter = {}) => {
    for (const [key, cond] of Object.entries(filter)) {
      if (key === '$or') {
        q = q.or(cond.map(orClause).join(','));
        continue;
      }

      // 'items.product': id  -> jsonb contains (setara match elemen array di Mongo)
      if (key.includes('.')) {
        const [arrKey, subKey] = key.split('.');
        q = q.contains(toSnake(arrKey), JSON.stringify([{ [subKey]: idOf(cond) }]));
        continue;
      }

      const col = ctx.colFor(key);

      if (isPlainValue(cond) || Array.isArray(cond)) {
        q = cond === null ? q.is(col, null) : q.eq(col, idOf(cond));
        continue;
      }

      for (const [op, v] of Object.entries(cond)) {
        if (op === '$ne') q = v === null ? q.not(col, 'is', null) : q.neq(col, v);
        else if (op === '$in') q = q.in(col, v);
        else if (op === '$gt') q = q.gt(col, v);
        else if (op === '$gte') q = q.gte(col, v);
        else if (op === '$lt') q = q.lt(col, v);
        else if (op === '$lte') q = q.lte(col, v);
        else throw new Error(`Operator ${op} belum didukung oleh adapter Supabase`);
      }
    }
    return q;
  };

  const sortSpec = (spec) => {
    const out = [];
    if (typeof spec === 'string') {
      for (const part of spec.split(/\s+/).filter(Boolean)) {
        out.push(part.startsWith('-') ? [ctx.colFor(part.slice(1)), false] : [ctx.colFor(part), true]);
      }
    } else if (spec) {
      for (const [k, dir] of Object.entries(spec)) {
        out.push([ctx.colFor(k), !(dir === -1 || dir === 'desc' || dir === 'descending')]);
      }
    }
    // tanpa sort -> urutan masuk (seperti natural order Mongo)
    if (!out.length) out.push(['created_at', true]);
    // tie-breaker supaya paging stabil
    if (!out.some(([c]) => c === 'id')) out.push(['id', true]);
    return out;
  };

  const selectRows = async (filter, { sort = null, limit = null } = {}) => {
    const build = () => {
      let q = getSupabase().from(table).select('*');
      q = applyFilter(q, filter);
      for (const [col, asc] of sortSpec(sort)) q = q.order(col, { ascending: asc });
      return q;
    };

    if (limit != null) {
      const { data, error } = await build().limit(limit);
      if (error) fail(error);
      return data;
    }

    // Tanpa limit: ambil semua baris (PostgREST membatasi 1000 baris per request)
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
      if (error) fail(error);
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    return rows;
  };

  // ---- update operators ----
  const splitUpdate = (update = {}) => {
    const set = {};
    for (const [k, v] of Object.entries(update)) if (!k.startsWith('$')) set[k] = v;
    Object.assign(set, update.$set || {});
    return {
      set,
      setOnInsert: update.$setOnInsert || {},
      inc: update.$inc || {},
      pull: update.$pull || {},
    };
  };

  const matchesPull = (item, cond) => {
    if (cond && typeof cond === 'object') {
      return Object.entries(cond).every(([k, v]) => String(idOf(item?.[k])) === String(v));
    }
    return String(idOf(item)) === String(cond);
  };

  const equalityFields = (filter = {}) => {
    const out = {};
    for (const [k, v] of Object.entries(filter)) {
      if (k.startsWith('$') || k.includes('.') || k === '_id') continue;
      if (isPlainValue(v)) out[k] = v;
    }
    return out;
  };

  const updateOne = async (filter, update, { upsert = false } = {}) => {
    const { set, setOnInsert, inc, pull } = splitUpdate(update);
    const supabase = getSupabase();

    let row = (await selectRows(filter, { limit: 1 }))[0];

    if (!row) {
      if (!upsert) return null;

      const insertRow = ctx.toRow({ ...equalityFields(filter), ...setOnInsert, ...set });
      for (const [k, delta] of Object.entries(inc)) insertRow[ctx.colFor(k)] = delta;

      const { data, error } = await supabase.from(table).insert(insertRow).select().single();
      if (!error) return ctx.hydrate(data);

      // dua request upsert bersamaan -> yang kedua kena unique violation, ambil yang sudah ada
      if (error.code !== '23505') fail(error);
      row = (await selectRows(filter, { limit: 1 }))[0];
      if (!row) fail(error);
    }

    const patch = ctx.toRow(set);

    for (const [field, cond] of Object.entries(pull)) {
      const col = ctx.colFor(field);
      const current = Array.isArray(row[col]) ? row[col] : [];
      patch[col] = current.filter((item) => !matchesPull(item, cond));
    }

    let latest = row;

    if (Object.keys(patch).length) {
      const { data, error } = await supabase
        .from(table)
        .update(patch)
        .eq('id', row.id)
        .select()
        .single();
      if (error) fail(error);
      latest = data;
    }

    // $inc dilakukan atomik lewat fungsi SQL app_increment (lihat supabase/schema.sql)
    const incEntries = Object.entries(inc);
    if (incEntries.length) {
      for (const [field, delta] of incEntries) {
        const { error } = await supabase.rpc('app_increment', {
          p_table: table,
          p_id: row.id,
          p_column: ctx.colFor(field),
          p_delta: Number(delta),
        });
        if (error) fail(error);
      }

      const { data, error } = await supabase.from(table).select('*').eq('id', row.id).single();
      if (error) fail(error);
      latest = data;
    }

    return ctx.hydrate(latest);
  };

  // ---- API publik model ----
  const Model = {
    _ctx: ctx,

    find: (filter = {}) =>
      new Query(ctx, async (qo) => {
        const rows = await selectRows(filter, { sort: qo._sort, limit: qo._limit });
        return rows.map(ctx.hydrate);
      }),

    findOne: (filter = {}) =>
      new Query(ctx, async (qo) => {
        const rows = await selectRows(filter, { sort: qo._sort, limit: 1 });
        return rows[0] ? ctx.hydrate(rows[0]) : null;
      }),

    findById: (id) =>
      new Query(ctx, async () => {
        if (id === undefined || id === null) return null;
        const rows = await selectRows({ _id: id }, { limit: 1 });
        return rows[0] ? ctx.hydrate(rows[0]) : null;
      }),

    async countDocuments(filter = {}) {
      let q = getSupabase().from(table).select('id', { count: 'exact', head: true });
      q = applyFilter(q, filter);
      const { count, error } = await q;
      if (error) fail(error);
      return count || 0;
    },

    async exists(filter = {}) {
      let q = getSupabase().from(table).select('id');
      q = applyFilter(q, filter).limit(1);
      const { data, error } = await q;
      if (error) fail(error);
      return data[0] ? { _id: data[0].id } : null;
    },

    async create(data) {
      const { data: inserted, error } = await getSupabase()
        .from(table)
        .insert(ctx.toRow(data))
        .select()
        .single();
      if (error) fail(error);
      return ctx.hydrate(inserted);
    },

    findOneAndUpdate: (filter, update, options = {}) =>
      new Query(ctx, () => updateOne(filter, update, options)),

    findByIdAndUpdate: (id, update, options = {}) =>
      new Query(ctx, () =>
        id === undefined || id === null ? null : updateOne({ _id: id }, update, options),
      ),

    async updateMany(filter, update) {
      const { set } = splitUpdate(update);
      let q = getSupabase().from(table).update(ctx.toRow(set));
      q = applyFilter(q, filter);
      const { error } = await q;
      if (error) fail(error);
    },

    findByIdAndDelete: (id) =>
      new Query(ctx, async () => {
        if (id === undefined || id === null) return null;
        const { data, error } = await getSupabase()
          .from(table)
          .delete()
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) fail(error);
        return data ? ctx.hydrate(data) : null;
      }),
  };

  return Model;
}

module.exports = createModel;

const { getSupabase } = require('./supabase');

const connectDb = async () => {
  try {
    const supabase = getSupabase();

    // Cek koneksi + pastikan skema (supabase/schema.sql) sudah dijalankan
    const { error } = await supabase
      .from('pre_order_settings')
      .select('id', { count: 'exact', head: true });

    if (error) throw new Error(error.message);

    console.log('Supabase connected');
    return supabase;
  } catch (error) {
    console.error('Error connecting to Supabase:', error.message);
    throw error;
  }
};

module.exports = connectDb;

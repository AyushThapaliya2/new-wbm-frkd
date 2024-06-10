import { supabase } from '@/lib/supabaseClient';

export const POST = async (req) => {
  const body = await req.json();
  const { unique_id, new_level } = body;

  if (!unique_id || new_level === undefined) {
    return new Response(JSON.stringify({ status: 0, msg: 'Invalid input' }), { status: 400 });
  }

  try {
    const { data: updateData, error: updateError } = await supabase
      .from('devices')
      .update({
        level: new_level,
        timestamp: new Date(),
      })
      .eq('unique_id', unique_id)
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ status: 1, msg: 'Updated the device level', data: updateData }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ status: 0, msg: 'Internal Server Error', error: error.message }), { status: 500 });
  }
};

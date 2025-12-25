import { supabase } from '$lib/supabaseClient';

export async function uploadMenuImage(
  file: File,
  restaurantId: string,
  itemId: string
): Promise<string> {
  const ext = file.name.split('.').pop();
  const filePath = `${restaurantId}/${itemId}.${ext}`;

  const { error } = await supabase.storage
    .from('menu-images')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('menu-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// import { redirect } from '@sveltejs/kit';
// import { supabase } from '$lib/supabaseClient';

// export const load = async ({ url }) => {
//   // ✅ Allow ALL login routes
//   if (url.pathname.startsWith('/dashboard/login')) {
//     return {};
//   }

//   const {
//     data: { session }
//   } = await supabase.auth.getSession();

//   if (!session) {
//     throw redirect(302, '/dashboard/login');
//   }

//   return { session };
// };

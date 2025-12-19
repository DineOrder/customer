<script lang="ts">
  import { supabase } from '$lib/supabaseClient';

  let email = '';
  let password = '';
  let loading = false;
  let error: string | null = null;

async function login() {
  if (!email || !password) {
    error = 'Please enter email and password';
    return;
  }

  error = null;
  loading = true;

  const { error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  loading = false;

  if (authError) {
    error = authError.message;
  }
}

</script>

<div class="min-h-screen flex items-center justify-center bg-slate-100 px-4">
  <div class="w-full max-w-md">
    <!-- CARD -->
    <div
      class="
        bg-white
        rounded-2xl
        border border-slate-200
        shadow-lg
        px-6 py-8
        sm:px-8 sm:py-10
      "
    >
      <!-- TITLE -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-slate-900">
          Kitchen Login
        </h1>
        <p class="text-sm text-slate-500 mt-2">
          Sign in to access the dashboard
        </p>
      </div>

      <!-- ERROR -->
      {#if error}
        <div
          class="
            mb-6 rounded-xl
            bg-red-50
            border border-red-200
            px-4 py-3
            text-sm text-red-700
          "
        >
          {error}
        </div>
      {/if}

      <!-- FORM -->
      <div class="space-y-6">
        <!-- EMAIL -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            Email
          </label>
          <input
            type="email"
            bind:value={email}
            placeholder="staff@restaurant.com"
            class="
              w-full
              rounded-xl
              border border-slate-300
              px-4 py-3
              text-base
              focus:outline-none
              focus:ring-2 focus:ring-slate-900
            "
          />
        </div>

        <!-- PASSWORD -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">
            Password
          </label>
          <input
            type="password"
            bind:value={password}
            placeholder="••••••••"
            class="
              w-full
              rounded-xl
              border border-slate-300
              px-4 py-3
              text-base
              focus:outline-none
              focus:ring-2 focus:ring-slate-900
            "
          />
        </div>

        <!-- CTA -->
        <button
          type="button"
          disabled={loading}
          class="
            w-full
            rounded-xl
            py-4
            text-base font-semibold
            bg-slate-900
            text-white
            hover:bg-slate-800
            active:scale-[0.97]
            transition
            disabled:opacity-60
            disabled:cursor-not-allowed
          "
          on:click={login}
        >
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </div>
    </div>
  </div>
</div>

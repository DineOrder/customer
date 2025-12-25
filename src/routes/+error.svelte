<script lang="ts">
  import { page } from '$app/stores';

  $: status = $page.status;
  $: error = $page.error;
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-100 px-4">
  <div class="max-w-md text-center bg-white border rounded-xl p-8">
    <h1 class="text-4xl font-bold text-slate-900 mb-2">
      {status}
    </h1>

    <p class="text-slate-600 mb-6">
      {status === 404
        ? "Sorry, we couldn't find this page."
        : "Something went wrong. Please try again."}
    </p>

    <a
      href="/dashboard"
      class="inline-block rounded-lg bg-slate-900 text-white px-6 py-3 text-sm font-medium"
    >
      Go Home
    </a>
  </div>
</div>

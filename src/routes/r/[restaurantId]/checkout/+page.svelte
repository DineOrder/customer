<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { supabase } from '$lib/supabaseClient';
  import { cart } from '$lib/stores/cart';
  import type { CartState } from '$lib/types/cart';

  /* ------------------ Types ------------------ */
  type PaymentMethod =
    | 'phonepe'
    | 'gpay'
    | 'paytm'
    | 'pay_at_counter';

  /* ------------------ Route Context ------------------ */
  $: restaurantId = page.params.restaurantId as string;

  /* ------------------ Cart ------------------ */
  $: cartState = $cart as CartState | null;

  /* ------------------ Derived ------------------ */
  $: orderType = cartState?.orderType;
  $: items = cartState?.items ?? [];

  $: totalAmount =
    items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  /* ------------------ Form State ------------------ */
  let mobileNumber = cartState?.mobileNumber ?? '';
  let paymentMethod: PaymentMethod | null = null;
  let submitting = false;

  /**
   * 🔴 CRITICAL FLAG
   * Prevents guard from redirecting while we are
   * intentionally clearing cart & navigating
   */
  let redirecting = false;

  /* ------------------ Guard ------------------ */
  $: if (!redirecting && (!cartState || items.length === 0)) {
    if (typeof window !== 'undefined') {
      goto(`/r/${restaurantId}/menu`);
    }
  }

  /* ------------------ Actions ------------------ */

  function selectPayment(method: PaymentMethod): void {
    paymentMethod = method;
  }

  async function placeOrder(): Promise<void> {
    if (!cartState || !paymentMethod || submitting) return;

    if (
      cartState.orderType === 'takeaway' &&
      mobileNumber.trim().length < 10
    ) {
      alert('Please enter a valid mobile number');
      return;
    }

    submitting = true;

    try {
      /* 1️⃣ Get next token number (RPC) */
      const { data: tokenNumber, error: tokenError } =
        await supabase.rpc('get_next_token', {
          rid: restaurantId
        });

      if (tokenError || !tokenNumber) {
        throw new Error('Token generation failed');
      }

      /* 2️⃣ Calculate total */
      const total = cartState.items.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );

      /* 3️⃣ Create order */
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          order_type: cartState.orderType,
          customer_phone:
            cartState.orderType === 'takeaway'
              ? mobileNumber
              : null,
          total_amount: total,
          payment_status: 'pending',
          status: 'pending',
          token_number: tokenNumber
        })
        .select()
        .single();

      if (orderError || !order) {
        throw new Error('Order creation failed');
      }

      /* 4️⃣ Insert order items */
      const orderItemsPayload = cartState.items.map((item) => ({
        order_id: order.id,
        item_id: item.itemId,
        quantity: item.quantity,
        price_per_item: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload);

      if (itemsError) {
        throw new Error('Order items insert failed');
      }

      const key = `qsr_orders_${restaurantId}`;
const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
localStorage.setItem(
  key,
  JSON.stringify([...existing, order.id])
);


      /* 5️⃣ IMPORTANT: suppress guard */
      redirecting = true;

      /* 6️⃣ Clear cart AFTER success */
      cart.clearCart();


      /* 7️⃣ Redirect to LIVE STATUS PAGE */
      goto(`/r/${restaurantId}/status`);
    } catch (err) {
      console.error(err);
      alert('Something went wrong. Please try again.');
      submitting = false;
    }
  }
</script>

<!-- ------------------ PAGE ------------------ -->
<div class="min-h-screen px-4 py-6">
  <h1 class="text-xl font-semibold mb-6">Checkout</h1>

  <!-- Order Summary -->
  <div class="border rounded-lg p-4 mb-6">
    <h2 class="font-medium mb-2">Order Summary</h2>

    <ul class="space-y-2 text-sm">
      {#each items as item (item.itemId)}
        <li class="flex justify-between">
          <span>{item.name} × {item.quantity}</span>
          <span>₹{item.price * item.quantity}</span>
        </li>
      {/each}
    </ul>

    <div class="flex justify-between font-semibold mt-4">
      <span>Total</span>
      <span>₹{totalAmount}</span>
    </div>
  </div>

  <!-- Takeaway Mobile -->
  {#if orderType === 'takeaway'}
    <div class="mb-6">
      <label for="mobile-number" class="block text-sm font-medium mb-1">
        Mobile Number
      </label>
      <input
        id="mobile-number"
        type="tel"
        class="w-full border rounded-lg px-3 py-2"
        placeholder="Enter mobile number"
        bind:value={mobileNumber}
      />
    </div>
  {/if}

  <!-- Payment Methods -->
  <div class="mb-6">
    <h2 class="font-medium mb-2">Payment Method</h2>

    <div class="space-y-2">
      <button
        class="w-full border rounded-lg px-4 py-3 text-left
          {paymentMethod === 'phonepe' ? 'border-black' : ''}"
        on:click={() => selectPayment('phonepe')}
      >
        PhonePe
      </button>

      <button
        class="w-full border rounded-lg px-4 py-3 text-left
          {paymentMethod === 'gpay' ? 'border-black' : ''}"
        on:click={() => selectPayment('gpay')}
      >
        Google Pay
      </button>

      <button
        class="w-full border rounded-lg px-4 py-3 text-left
          {paymentMethod === 'paytm' ? 'border-black' : ''}"
        on:click={() => selectPayment('paytm')}
      >
        Paytm
      </button>

      <button
        class="w-full border rounded-lg px-4 py-3 text-left
          {paymentMethod === 'pay_at_counter' ? 'border-black' : ''}"
        on:click={() => selectPayment('pay_at_counter')}
      >
        Pay at Counter
      </button>
    </div>
  </div>

  <!-- Place Order -->
  <button
    class="w-full py-4 rounded-xl text-white font-medium
      {paymentMethod && !submitting
        ? 'bg-black'
        : 'bg-gray-300 cursor-not-allowed'}"
    disabled={!paymentMethod || submitting}
    on:click={placeOrder}
  >
    {submitting ? 'Placing Order…' : 'Place Order'}
  </button>
</div>

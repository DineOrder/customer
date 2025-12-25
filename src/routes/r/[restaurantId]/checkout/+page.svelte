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

  type PaymentMode = 'online' | 'counter';

  /* ------------------ Route ------------------ */
  $: restaurantId = page.params.restaurantId as string;

  /* ------------------ Cart ------------------ */
  $: cartState = $cart as CartState | null;

  $: items = cartState?.items ?? [];
  $: orderType = cartState?.orderType;

  $: totalAmount =
    items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  /* ------------------ Form ------------------ */
  let mobileNumber = cartState?.mobileNumber ?? '';
  let paymentMethod: PaymentMethod | null = null;
  let submitting = false;
  let redirecting = false;

  /* ------------------ Guards ------------------ */
  $: if (!redirecting && (!cartState || items.length === 0)) {
    if (typeof window !== 'undefined') {
      goto(`/r/${restaurantId}/menu`);
    }
  }

  function getPaymentMode(method: PaymentMethod): PaymentMode {
    return method === 'pay_at_counter' ? 'counter' : 'online';
  }

  function selectPayment(method: PaymentMethod) {
    paymentMethod = method;
  }

  async function placeOrder() {
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
      /* Token */
      const { data: token, error: tokenError } =
        await supabase.rpc('get_next_token', {
          rid: restaurantId
        });

      if (tokenError || !token) throw new Error('Token failed');

      const paymentMode = getPaymentMode(paymentMethod);

      /* Create order */
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          order_type: cartState.orderType,
          customer_phone:
            cartState.orderType === 'takeaway'
              ? mobileNumber
              : null,
          total_amount: totalAmount,
          payment_mode: paymentMode,
          payment_status: 'pending',
          status: 'pending',
          token_number: token
        })
        .select()
        .single();

      if (orderError || !order) throw new Error('Order failed');

      /* Items */
      await supabase.from('order_items').insert(
        cartState.items.map((i) => ({
          order_id: order.id,
          item_id: i.itemId,
          quantity: i.quantity,
          price_per_item: i.price
        }))
      );

      /* Store order in session */
      const key = `qsr_orders_${restaurantId}`;
      const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
      localStorage.setItem(
        key,
        JSON.stringify([...existing, order.id])
      );

      cart.clearCart();
      redirecting = true;

      goto(`/r/${restaurantId}/status`);
    } catch (e) {
      console.error(e);
      alert('Something went wrong');
      submitting = false;
    }
  }
</script>

<!-- ================= UI ================= -->

<div class="min-h-screen px-4 py-6">
  <h1 class="text-xl font-semibold mb-6">Checkout</h1>

  <!-- ORDER SUMMARY -->
  <div class="mb-6 border rounded-xl p-4 bg-white space-y-2">
    {#each items as item}
      <div class="flex justify-between text-sm">
        <span>{item.quantity} × {item.name}</span>
        <span>₹{item.price * item.quantity}</span>
      </div>
    {/each}

    <div class="flex justify-between font-semibold pt-3 border-t">
      <span>Total</span>
      <span>₹{totalAmount}</span>
    </div>
  </div>

  <!-- MOBILE NUMBER -->
  {#if orderType === 'takeaway'}
    <div class="mb-6">
      <label for="" class="block text-sm font-medium mb-1">
        Mobile number
      </label>
      <input
        class="w-full border rounded-lg px-4 py-3"
        placeholder="Enter mobile number"
        bind:value={mobileNumber}
      />
    </div>
  {/if}

  <!-- PAYMENT OPTIONS -->
  <div class="mb-6">
    <h2 class="text-sm font-medium mb-3">Payment method</h2>

    <div class="space-y-3">
      <!-- ONLINE -->
      <button
        class="w-full border rounded-xl px-4 py-3 text-left
          {paymentMethod === 'gpay' ? 'border-black' : ''}"
        on:click={() => selectPayment('gpay')}
      >
        Pay Online (UPI / Cards)
      </button>

      <!-- COUNTER -->
      <button
        class="w-full border rounded-xl px-4 py-3 text-left
          {paymentMethod === 'pay_at_counter' ? 'border-black' : ''}"
        on:click={() => selectPayment('pay_at_counter')}
      >
        Pay at Counter
      </button>
    </div>
  </div>

  <!-- CTA -->
  <button
    class="
      w-full py-4 rounded-xl
      bg-black text-white
      text-lg font-medium
      disabled:opacity-50
    "
    disabled={!paymentMethod || submitting}
    on:click={placeOrder}
  >
    {submitting ? 'Placing order…' : `Place Order • ₹${totalAmount}`}
  </button>
</div>

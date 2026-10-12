import { Capacitor } from '@capacitor/core';
import { ErrorCode, Platform, ProductType, store } from 'capacitor-plugin-cdv-purchase';
import { supabase } from './supabaseClient';

const PRODUCT_IDS = ['gems_500', 'gems_1000', 'gems_6000'];
let initialized = false;

export async function initBilling({ onCredited, onError }) {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  store.register(
    PRODUCT_IDS.map((id) => ({
      id,
      type: ProductType.CONSUMABLE,
      platform: Platform.GOOGLE_PLAY,
    }))
  );

  store.when().approved(async (transaction) => {
    const productId = transaction.products?.[0]?.id;
    const purchaseToken = transaction.nativePurchase?.purchaseToken;
    if (!productId || !purchaseToken) {
      console.error('Transacción sin token:', JSON.stringify(transaction));
      return;
    }

    const { data, error } = await supabase.functions.invoke('verify-play-purchase', {
      body: { productId, purchaseToken },
    });

    if (error || !data?.success) {
      // NO se llama a finish(): el plugin reintenta en el próximo inicio
      onError?.(error?.message || data?.error || 'No se pudo validar la compra');
      return;
    }

    await transaction.finish(); // consume el producto: se puede volver a comprar
    onCredited?.(data.newBalance);
  });

  await store.initialize([Platform.GOOGLE_PLAY]);
}

export async function buyWithPlay(productId) {
  const offer = store.get(productId, Platform.GOOGLE_PLAY)?.getOffer();
  if (!offer) throw new Error('Producto no disponible todavía');
  const err = await offer.order();
  if (err && err.code !== ErrorCode.PAYMENT_CANCELLED) throw new Error(err.message);
}
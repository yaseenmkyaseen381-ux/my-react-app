import { validateCart } from "./api";
import { removeFromWishlist } from "./wishlist";

export const CART_KEY = "mobix-cart";

export function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(saved) ? saved.map((item) => typeof item === "string" ? { productId: item, quantity: 1 } : item).filter((item) => item?.productId && Number.isInteger(item.quantity) && item.quantity > 0) : [];
  } catch {
    localStorage.removeItem(CART_KEY);
    return [];
  }
}

export function saveCartLocally(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("mobix-cart-updated"));
  return items;
}

export async function validateAndSaveCart(items) {
  const validated = await validateCart(items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })));
  const next = validated.items.map(({ productId, variantId, variantName, name, category, image, quantity, price, stock, lineTotal }) => ({ productId, variantId, variantName, name, category, image, quantity, price, stock, lineTotal }));
  saveCartLocally(next);
  return { cart: next, total: validated.total };
}

export async function addProductToCart(productId, variantId = "") {
  const cart = readCart();
  const existing = cart.find((item) => item.productId === productId && (item.variantId || "") === variantId);
  const next = existing
    ? cart.map((item) => item.productId === productId && (item.variantId || "") === variantId ? { ...item, quantity: item.quantity + 1 } : item)
    : [...cart, { productId, variantId, quantity: 1 }];
  const result = await validateAndSaveCart(next);
  try {
    await removeFromWishlist(productId);
    return { ...result, wishlistUpdated: true };
  } catch {
    return { ...result, wishlistUpdated: false };
  }
}

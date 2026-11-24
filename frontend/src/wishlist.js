import { addWishlistItem, getWishlist, removeWishlistItem } from "./api";
import { getSessionToken } from "./authSession";

export const WISHLIST_KEY = "mobix-wishlist";

export function readWishlist() {
  try {
    const value = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  } catch {
    localStorage.removeItem(WISHLIST_KEY);
    return [];
  }
}

function writeWishlist(ids) {
  const uniqueIds = [...new Set(ids)];
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(uniqueIds));
  window.dispatchEvent(new Event("mobix-wishlist-updated"));
  return uniqueIds;
}

export async function loadWishlist() {
  if (!getSessionToken("user")) return readWishlist();
  const result = await getWishlist();
  return writeWishlist(result.productIds || []);
}

export async function toggleWishlist(productId) {
  const current = readWishlist();
  const removing = current.includes(productId);
  if (getSessionToken("user")) {
    if (removing) await removeWishlistItem(productId);
    else await addWishlistItem(productId);
  }
  return writeWishlist(
    removing
      ? current.filter((id) => id !== productId)
      : [...current, productId],
  );
}

export async function removeFromWishlist(productId) {
  if (getSessionToken("user")) await removeWishlistItem(productId);
  return writeWishlist(readWishlist().filter((id) => id !== productId));
}

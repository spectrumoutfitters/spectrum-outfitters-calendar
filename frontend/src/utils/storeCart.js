/** Shop storefront cart. Quantity <= 0 drops the line. Total is price * quantity, summed. */

export function addProductToCart(cart, product) {
  const existingItem = cart.find((item) => item.product_id === product.id);
  if (existingItem) {
    return cart.map((item) =>
      item.product_id === product.id
        ? { ...item, quantity: item.quantity + 1 }
        : item
    );
  }
  return [
    ...cart,
    {
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      quantity: 1,
    },
  ];
}

export function updateCartQuantity(cart, productId, quantity) {
  if (quantity <= 0) {
    return cart.filter((item) => item.product_id !== productId);
  }
  return cart.map((item) =>
    item.product_id === productId ? { ...item, quantity } : item
  );
}

export function sumCartTotal(cart) {
  return cart.reduce((total, item) => total + item.price * item.quantity, 0);
}

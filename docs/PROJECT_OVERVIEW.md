# Project overview

## Purpose

e-Sweets is a portfolio project that models the customer experience of an online bakery. Its goal is to demonstrate storefront design, product discovery, cart behavior, checkout UX, authentication, and responsive frontend implementation without claiming to be a live ordering service.

## Technology

- HTML5 for page structure and native dialogs
- CSS for the responsive design system and component layouts
- JavaScript ES modules for catalog, cart, search, checkout, and forms
- Browser `localStorage` for prototype-only persistence
- Supabase for authentication and account profiles
- Firebase Hosting configuration for static deployment

## Storefront flow

1. Customers browse or filter the built-in product catalog.
2. A product can be opened in the purchase panel to review its price, details, availability, fulfillment information, and quantity.
3. Add to cart saves the selection in `esweets-cart`; Buy now adds it and opens the cart.
4. Proceed to checkout collects contact and fulfillment details and shows the current order summary.
5. Place order validates the form, creates a local reference number, stores the request in `esweets-orders`, clears the cart, and displays confirmation.

## Browser storage

| Key | Purpose |
|---|---|
| `esweets-cart` | Guest cart items and quantities |
| `esweets-orders` | Locally created prototype order requests |
| `esweets-newsletter-email` | Latest newsletter email entered |
| `esweets-custom-draft` | Custom-order form draft |
| `esweets-contact-draft` | Contact form draft |

This data exists only on the current device and can be cleared by the browser. It must not be treated as a reliable business record.

## Supabase scope

Supabase currently supports customer authentication and profile roles. The repository includes migrations for profiles and public product-read policies. The storefront still renders `HARDCODED_PRODUCTS` from `public/js/home.js`; connecting it to Supabase is future work.

## Checkout limitations

The checkout is a UX prototype. It does not:

- process cards or other online payments;
- submit orders to Supabase or another backend;
- reserve or validate stock;
- calculate final delivery fees, taxes, or discounts;
- notify the customer or store;
- provide server-backed order tracking.

Cash on delivery/pickup is presented as the only active payment choice so the interface does not imply that online payment is already available.

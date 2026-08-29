import { supabase } from "./supabase.js";
import { watchAuthState } from "./auth.js";

// =========================================================
// DOM HELPERS
// =========================================================

function selectOne(selector) {
  return document.querySelector(selector);
}

function selectAll(selector) {
  return [...document.querySelectorAll(selector)];
}

// =========================================================
// STOREFRONT STATE
// =========================================================

const INITIAL_VISIBLE_PRODUCT_COUNT = 4;

let products = [];
let catalogLoaded = false;
let visibleProductCount = INITIAL_VISIBLE_PRODUCT_COUNT;
let activeProductFilter = "All";

// Supabase cart
let cart = [];

// Currently logged-in Supabase user
let currentUser = null;

let toastTimer;

// =========================================================
// MONEY
// =========================================================

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

// =========================================================
// PRODUCT CATALOG
// =========================================================

function hasRequiredProductFields(product) {
  return Boolean(
    product.name &&
      product.category &&
      product.image &&
      Number.isFinite(Number(product.price)),
  );
}

/*
  PRODUCTS ARE NOW LOADED FROM SUPABASE.

  Expected products columns:

  id
  name
  category
  description
  price
  image_url
  badge
*/

async function loadProducts() {
  const viewAllButton = selectOne("#viewAll");

  viewAllButton.hidden = true;

  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      category,
      description,
      price,
      image_url,
      badge
    `)
    .order("id", {
      ascending: true,
    });

  if (error) {
    console.error("Failed to load products:", error);

    products = [];
    catalogLoaded = true;

    selectOne("#productGrid").innerHTML =
      "<p>Unable to load our sweets right now.</p>";

    return;
  }

  products = (data || [])
    .map(function mapProduct(product) {
      return {
        id: String(product.id),
        dbId: product.id,
        name: product.name,
        category: product.category,
        description: product.description || "",
        price: Number(product.price),
        badge: product.badge || "",
        image: product.image_url,
      };
    })
    .filter(hasRequiredProductFields);

  catalogLoaded = true;

  renderProducts();

  // Load cart after products are available
  if (currentUser) {
    await loadCart();
  } else {
    renderCart();
  }
}

function getFilteredProducts() {
  if (activeProductFilter === "All") {
    return products;
  }

  return products.filter(function matchesActiveCategory(product) {
    return product.category === activeProductFilter;
  });
}

function createProductCardMarkup(product) {
  return `
    <article class="product-card">
      <div class="product-image">
        <img
          src="${product.image}"
          alt="${product.name}"
          loading="lazy"
          decoding="async"
          sizes="(max-width: 420px) 100vw, (max-width: 1020px) 50vw, 25vw"
        >

        ${
          product.badge
            ? `<span class="product-badge">${product.badge}</span>`
            : ""
        }

        <button
          class="quick-view"
          data-quick="${product.id}"
        >
          Quick view
        </button>
      </div>

      <div class="product-info">
        <span class="product-type">
          ${product.category.toUpperCase()}
        </span>

        <h3>${product.name}</h3>

        <p>${product.description}</p>

        <div class="product-bottom">
          <strong>${formatMoney(product.price)}</strong>

          <button
            class="add-button"
            data-add="${product.id}"
            aria-label="Add ${product.name} to cart"
          >
            +
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();

  const visibleProducts = filteredProducts.slice(
    0,
    visibleProductCount,
  );

  selectOne("#productGrid").innerHTML =
    visibleProducts.map(createProductCardMarkup).join("") ||
    "<p>No products found in this category.</p>";

  selectOne("#viewAll").hidden =
    visibleProductCount >= filteredProducts.length;
}

function findProduct(productId) {
  return products.find(function matchesProductId(product) {
    return product.id === String(productId);
  });
}

// =========================================================
// SUPABASE CART
// =========================================================

/*
  DATABASE:

  cart_items
  -------------------------
  id
  user_id
  product_id
  quantity
  created_at
  updated_at

  user_id    -> auth.users.id
  product_id -> products.id
*/

// Load ONLY the logged-in user's cart
async function loadCart() {
  if (!currentUser) {
    cart = [];
    renderCart();
    return;
  }

  const { data, error } = await supabase
    .from("cart_items")
    .select(`
      id,
      user_id,
      product_id,
      quantity,
      created_at,
      updated_at
    `)
    .eq("user_id", currentUser.id)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error("Failed to load cart:", error);

    cart = [];
    renderCart();

    showToast("Unable to load your cart.");

    return;
  }

  cart = (data || []).map(function mapCartItem(item) {
    return {
      cartItemId: item.id,
      id: String(item.product_id),
      qty: Number(item.quantity),
    };
  });

  renderCart();
}

// Add product to Supabase cart
async function addProductToCart(productId, quantity = 1) {
  if (!currentUser) {
    showToast("Please log in before adding items to your cart.");
    return;
  }

  const product = findProduct(productId);

  if (!product) {
    console.error("Product not found:", productId);
    return;
  }

  const safeQuantity = Math.max(
    1,
    Math.min(10, Number(quantity) || 1),
  );

  const numericProductId = Number(product.id);

  if (!Number.isInteger(numericProductId)) {
    console.error(
      "Invalid Supabase product ID:",
      product.id,
    );

    showToast("This product cannot be added right now.");

    return;
  }

  // Check if this product already exists
  // in THIS user's cart
  const { data: existingItem, error: findError } =
    await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", currentUser.id)
      .eq("product_id", numericProductId)
      .maybeSingle();

  if (findError) {
    console.error(
      "Failed to check cart:",
      findError,
    );

    showToast("Unable to update your cart.");

    return;
  }

  if (existingItem) {
    // Product already exists.
    // Increase quantity.

    const newQuantity = Math.min(
      10,
      Number(existingItem.quantity) + safeQuantity,
    );

    const { error } = await supabase
      .from("cart_items")
      .update({
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingItem.id)
      .eq("user_id", currentUser.id);

    if (error) {
      console.error(
        "Failed to update cart:",
        error,
      );

      showToast("Unable to update your cart.");

      return;
    }
  } else {
    // Product doesn't exist in cart yet.
    // Create new row.

    const { error } = await supabase
      .from("cart_items")
      .insert({
        user_id: currentUser.id,
        product_id: numericProductId,
        quantity: safeQuantity,
      });

    if (error) {
      console.error(
        "Failed to add item to cart:",
        error,
      );

      showToast("Unable to add this item to your cart.");

      return;
    }
  }

  await loadCart();

  showToast(`${product.name} added to your cart`);
}

// Remove product from Supabase cart
async function removeProductFromCart(productId) {
  if (!currentUser) {
    return;
  }

  const numericProductId = Number(productId);

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", currentUser.id)
    .eq("product_id", numericProductId);

  if (error) {
    console.error(
      "Failed to remove cart item:",
      error,
    );

    showToast("Unable to remove item.");

    return;
  }

  await loadCart();
}

// Clear the logged-in user's cart
async function clearUserCart() {
  if (!currentUser) {
    return;
  }

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(
      "Failed to clear cart:",
      error,
    );

    return;
  }

  cart = [];

  renderCart();
}

// =========================================================
// CART DISPLAY
// =========================================================

function createEmptyCartMarkup() {
  return `
    <div class="empty-cart">
      <span>♡</span>

      <h3>Your cart is waiting.</h3>

      <p>
        Add something delightful and it will appear here.
      </p>

      <button
        class="text-link"
        data-close
      >
        Browse sweets →
      </button>
    </div>
  `;
}

function createCartItemMarkup(item) {
  const product = findProduct(item.id);

  if (!product) {
    return "";
  }

  return `
    <div class="cart-item">

      <img
        src="${product.image}"
        alt="${product.name}"
      >

      <div>

        <h3>${product.name}</h3>

        <small>
          ${formatMoney(product.price)} × ${item.qty}
        </small>

        <button
          type="button"
          data-remove="${product.id}"
        >
          Remove
        </button>

      </div>

      <strong>
        ${formatMoney(product.price * item.qty)}
      </strong>

    </div>
  `;
}

function calculateCartSubtotal() {
  return cart.reduce(
    function addItemSubtotal(total, item) {
      const product = findProduct(item.id);

      if (!product) {
        return total;
      }

      return total + product.price * item.qty;
    },
    0,
  );
}

function renderCart() {
  const totalQuantity = cart.reduce(
    function addItemQuantity(total, item) {
      return total + item.qty;
    },
    0,
  );

  selectOne("#cartCount").textContent = totalQuantity;

  if (!catalogLoaded) {
    selectOne("#cartItems").innerHTML =
      "<p>Loading your cart…</p>";

    selectOne("#cartSubtotal").textContent =
      formatMoney(0);

    return;
  }

  const validCart = cart.filter(function validItem(item) {
    return Boolean(findProduct(item.id));
  });

  selectOne("#cartItems").innerHTML = validCart.length
    ? validCart.map(createCartItemMarkup).join("")
    : createEmptyCartMarkup();

  selectOne("#cartSubtotal").textContent =
    formatMoney(calculateCartSubtotal());
}

// =========================================================
// CART DRAWER
// =========================================================

function openCart() {
  selectOne("#cartDrawer").classList.add("open");

  selectOne("#cartDrawer").setAttribute(
    "aria-hidden",
    "false",
  );

  selectOne("#overlay").classList.add("show");

  document.body.classList.add("no-scroll");

  setTimeout(function focusCartCloseButton() {
    selectOne(".drawer-close")?.focus();
  }, 100);
}

function closeCart() {
  selectOne("#cartDrawer").classList.remove("open");

  selectOne("#cartDrawer").setAttribute(
    "aria-hidden",
    "true",
  );

  selectOne("#overlay").classList.remove("show");

  document.body.classList.remove("no-scroll");
}

// =========================================================
// SHARED UI
// =========================================================

function showToast(message) {
  const toast = selectOne("#toast");

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(function hideToast() {
    toast.classList.remove("show");
  }, 2600);
}

function showProductQuickView(productId) {
  const product = findProduct(productId);

  if (!product) {
    return;
  }

  selectOne("#quickViewContent").innerHTML = `
    <div class="purchase-layout">

      <div class="purchase-gallery">

        ${
          product.badge
            ? `<span class="product-badge">${product.badge}</span>`
            : ""
        }

        <img
          src="${product.image}"
          alt="${product.name}"
        >

        <p>Freshly prepared for your order</p>

      </div>

      <div class="purchase-details">

        <p class="eyebrow">
          ${product.category}
        </p>

        <h2>${product.name}</h2>

        <div
          class="purchase-rating"
          aria-label="New product, no reviews yet"
        >
          <span aria-hidden="true">
            ☆ ☆ ☆ ☆ ☆
          </span>

          <small>
            No reviews yet
          </small>
        </div>

        <hr>

        <p class="purchase-price">
          <small>Price</small>
          ${formatMoney(product.price)}
        </p>

        <p class="purchase-tax">
          VAT included. Delivery is calculated at checkout.
        </p>

        <p class="purchase-description">
          ${product.description}
        </p>

        <div class="purchase-perks">

          <span>
            <b>✦</b>
            <small>
              Freshly<br>
              prepared
            </small>
          </span>

          <span>
            <b>⌂</b>
            <small>
              Pickup or<br>
              delivery
            </small>
          </span>

          <span>
            <b>♡</b>
            <small>
              Gift-ready<br>
              packing
            </small>
          </span>

        </div>

        <details>

          <summary>
            Product & allergen information
          </summary>

          <p>
            Prepared in small batches.
            Please contact us before ordering
            if you have allergies or dietary requirements.
          </p>

        </details>

      </div>

      <aside
        class="purchase-box"
        aria-label="Purchase options"
      >

        <p class="purchase-box-price">
          ${formatMoney(product.price)}
        </p>

        <p class="delivery-note">
          <b>
            Delivery details confirmed at checkout
          </b>
          <br>
          Choose pickup or local delivery
          and your preferred schedule.
        </p>

        <p class="stock-status">
          In stock
        </p>

        <label for="purchaseQuantity">
          Quantity
        </label>

        <select
          id="purchaseQuantity"
          data-purchase-quantity
        >
          ${[1,2,3,4,5,6,7,8,9,10]
            .map(
              (quantity) =>
                `<option value="${quantity}">
                  ${quantity}
                </option>`,
            )
            .join("")}
        </select>

        <button
          class="purchase-action add-cart-action"
          data-modal-add="${product.id}"
        >
          Add to cart
        </button>

        <button
          class="purchase-action buy-now-action"
          data-buy-now="${product.id}"
        >
          Buy now
        </button>

        <dl class="purchase-meta">

          <div>
            <dt>Ships from</dt>
            <dd>e-Sweets</dd>
          </div>

          <div>
            <dt>Sold by</dt>
            <dd>e-Sweets</dd>
          </div>

          <div>
            <dt>Payment</dt>
            <dd>Secure checkout</dd>
          </div>

        </dl>

      </aside>

    </div>
  `;

  selectOne("#quickViewDialog").showModal();
}

function closeDialogFromButton(button) {
  const dialog = button.closest("dialog");

  dialog?.close();
}

// =========================================================
// PRODUCT EVENT HANDLERS
// =========================================================

function handleProductGridClick(event) {
  const addButton =
    event.target.closest("[data-add]");

  const quickViewButton =
    event.target.closest("[data-quick]");

  if (addButton) {
    addProductToCart(addButton.dataset.add);
  }

  if (quickViewButton) {
    showProductQuickView(
      quickViewButton.dataset.quick,
    );
  }
}

function handleProductFilterClick(event) {
  const filterButton =
    event.target.closest(
      "[data-product-filter]",
    );

  if (!filterButton) {
    return;
  }

  activeProductFilter =
    filterButton.dataset.productFilter;

  visibleProductCount =
    INITIAL_VISIBLE_PRODUCT_COUNT;

  selectAll(".filter-pills button").forEach(
    function updateFilterButton(button) {
      button.classList.toggle(
        "active",
        button === filterButton,
      );
    },
  );

  renderProducts();
}

function handleCategoryLinkClick(event) {
  activeProductFilter =
    event.currentTarget.dataset.filter;

  visibleProductCount =
    INITIAL_VISIBLE_PRODUCT_COUNT;

  selectAll(".filter-pills button").forEach(
    function updateFilterButton(button) {
      button.classList.toggle(
        "active",
        button.dataset.productFilter ===
          activeProductFilter,
      );
    },
  );

  renderProducts();
}

function handleViewAllClick() {
  visibleProductCount = products.length;

  renderProducts();
}

// =========================================================
// CHECKOUT
// =========================================================

function createCheckoutItemMarkup(item) {
  const product = findProduct(item.id);

  if (!product) {
    return "";
  }

  return `
    <div class="checkout-item">

      <img
        src="${product.image}"
        alt="${product.name}"
      >

      <span>
        <b>${product.name}</b>
        <small>
          Qty ${item.qty}
        </small>
      </span>

      <strong>
        ${formatMoney(
          product.price * item.qty,
        )}
      </strong>

    </div>
  `;
}

function renderCheckoutSummary() {
  const subtotal =
    calculateCartSubtotal();

  selectOne("#checkoutItems").innerHTML =
    cart
      .map(createCheckoutItemMarkup)
      .join("");

  selectOne("#checkoutSubtotal").textContent =
    formatMoney(subtotal);

  selectOne("#checkoutTotal").textContent =
    formatMoney(subtotal);
}

function handleCheckoutClick() {
  if (!currentUser) {
    showToast(
      "Please log in before checking out.",
    );

    return;
  }

  if (!cart.length) {
    showToast(
      "Add a sweet before checking out.",
    );

    return;
  }

  closeCart();

  selectOne("#checkoutForm").hidden = false;

  selectOne("#orderSuccess").hidden = true;

  selectOne("#checkoutMessage").textContent =
    "";

  const dateInput =
    selectOne(
      '#checkoutForm input[name="date"]',
    );

  if (dateInput) {
    dateInput.min =
      new Date()
        .toISOString()
        .split("T")[0];
  }

  renderCheckoutSummary();

  selectOne("#checkoutDialog").showModal();
}

function handleFulfillmentChange(event) {
  if (
    event.target.name !==
    "fulfillment"
  ) {
    return;
  }

  const isDelivery =
    event.target.value ===
    "delivery";

  const addressField =
    selectOne(
      "#deliveryAddressField",
    );

  addressField.hidden =
    !isDelivery;

  addressField
    .querySelector("textarea")
    .required = isDelivery;

  selectOne(
    "#checkoutDelivery",
  ).textContent =
    isDelivery
      ? "Confirmed later"
      : "Free";
}

// =========================================================
// CHECKOUT SUBMIT
// =========================================================

/*
  NOTE:

  This function expects your orders table
  and order_items table to contain these fields:

  orders:
    id
    user_id
    reference
    status
    subtotal
    customer_name
    customer_email
    customer_phone
    fulfillment
    delivery_address
    requested_date
    notes

  order_items:
    id
    order_id
    product_id
    quantity
    unit_price
    subtotal
*/

async function handleCheckoutSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    showToast(
      "Please log in before placing an order.",
    );

    return;
  }

  if (
    !event.currentTarget.checkValidity()
  ) {
    event.currentTarget.reportValidity();

    return;
  }

  if (!cart.length) {
    showToast(
      "Your cart is empty.",
    );

    return;
  }

  const details =
    Object.fromEntries(
      new FormData(
        event.currentTarget,
      ),
    );

  const subtotal =
    calculateCartSubtotal();

  const reference =
    `ES-${Date.now()
      .toString()
      .slice(-8)}`;

  // -----------------------------------------
  // CREATE ORDER
  // -----------------------------------------

  const {
    data: order,
    error: orderError,
  } = await supabase
    .from("orders")
    .insert({
      user_id: currentUser.id,

      reference: reference,

      status:
        "pending-confirmation",

      subtotal: subtotal,

      customer_name:
        details.name,

      customer_email:
        details.email,

      customer_phone:
        details.phone,

      fulfillment:
        details.fulfillment,

      delivery_address:
        details.address || null,

      requested_date:
        details.date || null,

      notes:
        details.notes || null,
    })
    .select()
    .single();

  if (orderError) {
    console.error(
      "Order creation failed:",
      orderError,
    );

    showToast(
      "Unable to place your order.",
    );

    return;
  }

  // -----------------------------------------
  // CREATE ORDER ITEMS
  // -----------------------------------------

  const orderItems =
    cart.map(function createOrderItem(item) {
      const product =
        findProduct(item.id);

      return {
        order_id: order.id,

        product_id:
          Number(product.id),

        quantity:
          item.qty,

        unit_price:
          product.price,

        subtotal:
          product.price * item.qty,
      };
    });

  const {
    error: itemsError,
  } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    console.error(
      "Order items creation failed:",
      itemsError,
    );

    showToast(
      "Order was created but items could not be saved.",
    );

    return;
  }

  // -----------------------------------------
  // CLEAR ONLY CURRENT USER'S CART
  // -----------------------------------------

  await clearUserCart();

  // -----------------------------------------
  // SHOW SUCCESS
  // -----------------------------------------

  event.currentTarget.reset();

  event.currentTarget.hidden = true;

  const success =
    selectOne("#orderSuccess");

  success.hidden = false;

  success.innerHTML = `
    <span>✓</span>

    <p class="eyebrow">
      ORDER RECEIVED
    </p>

    <h2>
      Thank you, ${details.name}!
    </h2>

    <p>
      Your order request
      <strong>${reference}</strong>
      has been saved.

      The store will confirm availability,
      delivery fees, and schedule using
      your contact details.
    </p>

    <button
      class="button button-dark"
      type="button"
      data-dialog-close
    >
      Continue shopping →
    </button>
  `;
}

// =========================================================
// DOCUMENT CLICK
// =========================================================

function handleDocumentClick(event) {
  const closeCartButton =
    event.target.closest(
      "[data-close]",
    );

  const removeButton =
    event.target.closest(
      "[data-remove]",
    );

  const modalAddButton =
    event.target.closest(
      "[data-modal-add]",
    );

  const buyNowButton =
    event.target.closest(
      "[data-buy-now]",
    );

  const dialogCloseButton =
    event.target.closest(
      "[data-dialog-close]",
    );

  if (closeCartButton) {
    closeCart();
  }

  if (removeButton) {
    removeProductFromCart(
      removeButton.dataset.remove,
    );
  }

  if (modalAddButton) {
    const quantity =
      selectOne(
        "[data-purchase-quantity]",
      )?.value || 1;

    addProductToCart(
      modalAddButton.dataset.modalAdd,
      quantity,
    );

    selectOne(
      "#quickViewDialog",
    ).close();
  }

  if (buyNowButton) {
    const quantity =
      selectOne(
        "[data-purchase-quantity]",
      )?.value || 1;

    addProductToCart(
      buyNowButton.dataset.buyNow,
      quantity,
    );

    selectOne(
      "#quickViewDialog",
    ).close();

    openCart();
  }

  if (dialogCloseButton) {
    closeDialogFromButton(
      dialogCloseButton,
    );
  }

  if (
    selectOne(
      "#navLinks",
    ).classList.contains("open") &&
    !event.target.closest("#navLinks") &&
    !event.target.closest("#menuToggle")
  ) {
    setMobileNavigation(false);
  }
}

// =========================================================
// HEADER NAVIGATION
// =========================================================

const navigationLinks =
  selectAll(
    "#navLinks a[href^='#']",
  );

const navigationSections =
  navigationLinks
    .map(function findNavigationSection(
      link,
    ) {
      return selectOne(link.hash);
    })
    .filter(Boolean);

let navigationTargetId = null;
let navigationUnlockTimer;
let navigationScrollFrame;

function setActiveNavigation(
  sectionId,
) {
  navigationLinks.forEach(
    function updateNavigationLink(
      link,
    ) {
      const isActive =
        link.hash ===
        `#${sectionId}`;

      link.classList.toggle(
        "active",
        isActive,
      );

      if (isActive) {
        link.setAttribute(
          "aria-current",
          "location",
        );
      } else {
        link.removeAttribute(
          "aria-current",
        );
      }
    },
  );
}

function syncActiveNavigation() {
  if (navigationTargetId) {
    return;
  }

  const navigationMarker =
    window.scrollY +
    selectOne(
      ".site-header",
    ).offsetHeight +
    140;

  let currentSection =
    navigationSections[0];

  navigationSections.forEach(
    function findCurrentSection(
      section,
    ) {
      if (
        section.offsetTop <=
        navigationMarker
      ) {
        currentSection =
          section;
      }
    },
  );

  const isAtPageBottom =
    window.innerHeight +
      window.scrollY >=
    document.documentElement
      .scrollHeight - 2;

  if (isAtPageBottom) {
    currentSection =
      navigationSections.at(-1);
  }

  if (currentSection) {
    setActiveNavigation(
      currentSection.id,
    );
  }
}

function handleWindowScroll() {
  if (navigationScrollFrame) {
    return;
  }

  navigationScrollFrame =
    requestAnimationFrame(
      function updateNavigationOnFrame() {
        syncActiveNavigation();

        navigationScrollFrame =
          null;
      },
    );
}

function unlockNavigationTracking() {
  if (!navigationTargetId) {
    return;
  }

  clearTimeout(
    navigationUnlockTimer,
  );

  navigationTargetId =
    null;

  syncActiveNavigation();
}

function setMobileNavigation(
  isOpen,
) {
  selectOne(
    "#navLinks",
  ).classList.toggle(
    "open",
    isOpen,
  );

  selectOne(
    "#menuToggle",
  ).setAttribute(
    "aria-expanded",
    String(isOpen),
  );

  selectOne(
    "#menuToggle",
  ).setAttribute(
    "aria-label",
    isOpen
      ? "Close menu"
      : "Open menu",
  );

  document.body.classList.toggle(
    "nav-open",
    isOpen,
  );
}

function handleMenuToggleClick(
  event,
) {
  event.stopPropagation();

  const isOpen =
    selectOne(
      "#navLinks",
    ).classList.contains(
      "open",
    );

  setMobileNavigation(
    !isOpen,
  );
}

function handleNavigationLinkClick(
  event,
) {
  navigationTargetId =
    event.currentTarget.hash.slice(
      1,
    );

  setActiveNavigation(
    navigationTargetId,
  );

  clearTimeout(
    navigationUnlockTimer,
  );

  navigationUnlockTimer =
    setTimeout(
      function resumeNavigationTracking() {
        navigationTargetId =
          null;

        syncActiveNavigation();
      },
      1200,
    );

  setMobileNavigation(
    false,
  );
}

function handleWindowResize() {
  if (window.innerWidth > 1020) {
    setMobileNavigation(false);
  }
}

function handleAnnouncementClose() {
  selectOne(
    "#announcement",
  ).remove();
}

function updateAccountLink(
  user,
) {
  const accountLink =
    selectOne(".account-link");

  accountLink.href =
    user
      ? "account.html"
      : "login.html";

  accountLink.setAttribute(
    "aria-label",
    user
      ? "Open customer account"
      : "Log in to your account",
  );
}

// =========================================================
// AUTH STATE
// =========================================================

async function handleAuthStateChange(
  user,
) {
  currentUser =
    user || null;

  updateAccountLink(
    currentUser,
  );

  if (currentUser) {
    console.log(
      "Logged in user:",
      currentUser.id,
    );

    await loadCart();
  } else {
    console.log(
      "No user logged in.",
    );

    // IMPORTANT:
    // Clear cart from the page when user logs out.
    // This does NOT delete the database cart.
    cart = [];

    renderCart();
  }
}

// =========================================================
// SEARCH
// =========================================================

function openSearchPanel() {
  selectOne(
    "#searchPanel",
  ).hidden = false;

  document.body.classList.add(
    "no-scroll",
  );

  setTimeout(
    function focusSearchInput() {
      selectOne(
        "#searchInput",
      ).focus();
    },
    50,
  );
}

function closeSearchPanel() {
  selectOne(
    "#searchPanel",
  ).hidden = true;

  document.body.classList.remove(
    "no-scroll",
  );
}

function productMatchesSearch(
  product,
  normalizedQuery,
) {
  const searchableText = [
    product.name,
    product.category,
    product.description,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(
    normalizedQuery,
  );
}

function createSearchResultMarkup(
  product,
) {
  return `
    <button
      type="button"
      data-search-id="${product.id}"
    >
      <strong>
        ${product.name}
      </strong>
      ·
      ${formatMoney(product.price)}
    </button>
  `;
}

function runProductSearch(query) {
  const normalizedQuery =
    query.toLowerCase();

  const matchingProducts =
    products.filter(
      function matchesQuery(
        product,
      ) {
        return productMatchesSearch(
          product,
          normalizedQuery,
        );
      },
    );

  const searchResults =
    selectOne(
      "#searchResults",
    );

  searchResults.className =
    "search-result-list";

  if (!query) {
    searchResults.innerHTML =
      "";

    return;
  }

  searchResults.innerHTML =
    matchingProducts.length
      ? matchingProducts
          .map(
            createSearchResultMarkup,
          )
          .join("")
      : "<p>No sweets found. Try cake, cookie or pastry.</p>";
}

function handleSearchInput(
  event,
) {
  runProductSearch(
    event.target.value.trim(),
  );
}

function handleSearchSubmit(
  event,
) {
  event.preventDefault();

  runProductSearch(
    selectOne(
      "#searchInput",
    ).value.trim(),
  );
}

function handleSearchResultClick(
  event,
) {
  const resultButton =
    event.target.closest(
      "[data-search-id]",
    );

  if (!resultButton) {
    return;
  }

  closeSearchPanel();

  showProductQuickView(
    resultButton.dataset.searchId,
  );
}

// =========================================================
// NEWSLETTER
// =========================================================

function handleNewsletterSubmit(
  event,
) {
  event.preventDefault();

  const emailInput =
    selectOne(
      "#newsletterEmail",
    );

  const message =
    selectOne(
      "#newsletterMessage",
    );

  if (!emailInput.validity.valid) {
    message.textContent =
      "Please enter a valid email address.";

    emailInput.focus();

    return;
  }

  // NOTE:
  // This is still localStorage because
  // it is NOT the cart.
  localStorage.setItem(
    "esweets-newsletter-email",
    emailInput.value,
  );

  message.textContent =
    "You’re on the list — thank you!";

  event.currentTarget.reset();
}

// =========================================================
// CUSTOM ORDER
// =========================================================

function openCustomOrderDialog() {
  selectOne(
    "#customOrderDialog",
  ).showModal();
}

function handleCustomOrderSubmit(
  event,
) {
  event.preventDefault();

  if (
    !event.currentTarget.checkValidity()
  ) {
    event.currentTarget.reportValidity();

    return;
  }

  const customOrderDraft =
    Object.fromEntries(
      new FormData(
        event.currentTarget,
      ),
    );

  // NOTE:
  // This is still localStorage for now.
  // We can move custom orders to Supabase next.
  localStorage.setItem(
    "esweets-custom-draft",
    JSON.stringify(
      customOrderDraft,
    ),
  );

  selectOne(
    "#customMessage",
  ).textContent =
    "Draft saved. Backend submission will be enabled when connected.";

  showToast(
    "Custom order draft saved",
  );
}

// =========================================================
// CONTACT
// =========================================================

function openContactDialog() {
  selectOne(
    "#contactDialog",
  ).showModal();
}

function handleContactSubmit(
  event,
) {
  event.preventDefault();

  if (
    !event.currentTarget.checkValidity()
  ) {
    event.currentTarget.reportValidity();

    return;
  }

  const concernDraft =
    Object.fromEntries(
      new FormData(
        event.currentTarget,
      ),
    );

  // NOTE:
  // This is still localStorage for now.
  // We can move contacts to Supabase next.
  localStorage.setItem(
    "esweets-contact-draft",
    JSON.stringify(
      concernDraft,
    ),
  );

  selectOne(
    "#contactMessage",
  ).textContent =
    "Concern saved as a draft on this device.";

  showToast(
    "Concern draft saved",
  );
}

// =========================================================
// KEYBOARD
// =========================================================

function handleDocumentKeydown(
  event,
) {
  if (event.key !== "Escape") {
    return;
  }

  setMobileNavigation(false);

  closeCart();

  if (
    !selectOne(
      "#searchPanel",
    ).hidden
  ) {
    closeSearchPanel();
  }
}

// =========================================================
// EVENT LISTENERS
// =========================================================

function registerEventListeners() {
  selectOne(
    "#productGrid",
  ).addEventListener(
    "click",
    handleProductGridClick,
  );

  selectOne(
    ".filter-pills",
  ).addEventListener(
    "click",
    handleProductFilterClick,
  );

  selectAll(
    "[data-filter]",
  ).forEach(
    function registerCategoryLink(
      link,
    ) {
      link.addEventListener(
        "click",
        handleCategoryLinkClick,
      );
    },
  );

  selectOne(
    "#viewAll",
  ).addEventListener(
    "click",
    handleViewAllClick,
  );

  selectOne(
    "#cartOpen",
  ).addEventListener(
    "click",
    openCart,
  );

  selectOne(
    "#overlay",
  ).addEventListener(
    "click",
    closeCart,
  );

  selectOne(
    "#checkoutButton",
  ).addEventListener(
    "click",
    handleCheckoutClick,
  );

  selectOne(
    "#checkoutForm",
  ).addEventListener(
    "change",
    handleFulfillmentChange,
  );

  selectOne(
    "#checkoutForm",
  ).addEventListener(
    "submit",
    handleCheckoutSubmit,
  );

  selectOne(
    "#menuToggle",
  ).addEventListener(
    "click",
    handleMenuToggleClick,
  );

  navigationLinks.forEach(
    function registerNavigationLink(
      link,
    ) {
      link.addEventListener(
        "click",
        handleNavigationLinkClick,
      );
    },
  );

  window.addEventListener(
    "scroll",
    handleWindowScroll,
    {
      passive: true,
    },
  );

  window.addEventListener(
    "scrollend",
    unlockNavigationTracking,
  );

  window.addEventListener(
    "resize",
    handleWindowResize,
  );

  selectOne(
    "#closeAnnouncement",
  ).addEventListener(
    "click",
    handleAnnouncementClose,
  );

  // Search
  selectOne(
    "#searchOpen",
  ).addEventListener(
    "click",
    openSearchPanel,
  );

  selectOne(
    "#searchClose",
  ).addEventListener(
    "click",
    closeSearchPanel,
  );

  selectOne(
    "#searchInput",
  ).addEventListener(
    "input",
    handleSearchInput,
  );

  selectOne(
    "#searchForm",
  ).addEventListener(
    "submit",
    handleSearchSubmit,
  );

  selectOne(
    "#searchResults",
  ).addEventListener(
    "click",
    handleSearchResultClick,
  );

  // Newsletter
  selectOne(
    "#newsletterForm",
  ).addEventListener(
    "submit",
    handleNewsletterSubmit,
  );

  // Custom order
  selectOne(
    "#customOrderOpen",
  ).addEventListener(
    "click",
    openCustomOrderDialog,
  );

  selectOne(
    "#customForm",
  ).addEventListener(
    "submit",
    handleCustomOrderSubmit,
  );

  // Contact
  selectOne(
    "#contactOpen",
  ).addEventListener(
    "click",
    openContactDialog,
  );

  selectOne(
    "#contactForm",
  ).addEventListener(
    "submit",
    handleContactSubmit,
  );

  // Global
  document.addEventListener(
    "click",
    handleDocumentClick,
  );

  document.addEventListener(
    "keydown",
    handleDocumentKeydown,
  );
}

// =========================================================
// START APPLICATION
// =========================================================

async function initializeStorefront() {
  selectOne(
    "#year",
  ).textContent =
    new Date().getFullYear();

  registerEventListeners();

  syncActiveNavigation();

  renderCart();

  /*
    Load products first.

    After products are loaded,
    the user's cart can correctly
    match product IDs.
  */
  await loadProducts();

  /*
    Watch Supabase authentication.

    When User A logs in:
      load User A's cart.

    When User A logs out:
      clear cart from screen.

    When User B logs in:
      load User B's cart.
  */
  watchAuthState(
    handleAuthStateChange,
  );
}

initializeStorefront();
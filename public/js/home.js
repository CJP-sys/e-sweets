import { watchAuthState } from "./auth.js";

// DOM helpers

function selectOne(selector) {
  return document.querySelector(selector);
}

function selectAll(selector) {
  return [...document.querySelectorAll(selector)];
}

// Storefront state

const INITIAL_VISIBLE_PRODUCT_COUNT = 4;
const CART_STORAGE_KEY = "esweets-cart";

let products = [];
let catalogLoaded = false;
let visibleProductCount = INITIAL_VISIBLE_PRODUCT_COUNT;
let activeProductFilter = "All";
let cart = loadStoredCart();
let toastTimer;

function loadStoredCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
  } catch (error) {
    console.warn("The saved cart could not be read and was reset.", error);
    return [];
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

// Product catalog

const HARDCODED_PRODUCTS = [
  {
    id: "strawberry-dream-cake",
    name: "Strawberry Dream Cake",
    category: "Cakes",
    description: "Vanilla chiffon, fresh strawberries, and light whipped cream.",
    price: 1250,
    badge: "BEST SELLER",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=82",
  },
  {
    id: "chocolate-celebration-cake",
    name: "Chocolate Celebration Cake",
    category: "Cakes",
    description: "Deep chocolate sponge layered with silky chocolate ganache.",
    price: 1450,
    badge: "CELEBRATION FAVORITE",
    image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=900&q=82",
  },
  {
    id: "ube-cloud-cake",
    name: "Ube Cloud Cake",
    category: "Cakes",
    description: "Soft ube chiffon finished with creamy purple-yam frosting.",
    price: 1350,
    badge: "FILIPINO FAVORITE",
    image: "https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&w=900&q=82",
  },
  {
    id: "classic-chocolate-chip",
    name: "Classic Chocolate Chip",
    category: "Cookies",
    description: "Six chewy butter cookies packed with dark chocolate chunks.",
    price: 420,
    badge: "BOX OF 6",
    image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=900&q=82",
  },
  {
    id: "red-velvet-crinkles",
    name: "Red Velvet Crinkles",
    category: "Cookies",
    description: "Fudgy red velvet cookies rolled in a snowy sugar coating.",
    price: 450,
    badge: "BOX OF 8",
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=82",
  },
  {
    id: "butter-croissant-box",
    name: "Butter Croissant Box",
    category: "Pastries",
    description: "Four flaky, golden croissants made with cultured butter.",
    price: 520,
    badge: "BAKED TODAY",
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=82",
  },
  {
    id: "cinnamon-rolls",
    name: "Brown Sugar Cinnamon Rolls",
    category: "Pastries",
    description: "Four pillowy rolls with cinnamon filling and cream-cheese glaze.",
    price: 580,
    badge: "BOX OF 4",
    image: "https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&w=900&q=82",
  },
  {
    id: "assorted-macarons",
    name: "Pastel Macaron Collection",
    category: "Pastries",
    description: "Twelve delicate macarons in a rotating selection of flavors.",
    price: 780,
    badge: "GIFT READY",
    image: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=900&q=82",
  },
];

function hasRequiredProductFields(product) {
  return Boolean(
    product.name &&
    product.category &&
    product.description &&
    product.image &&
    Number.isFinite(product.price),
  );
}

function loadProducts() {
  const viewAllButton = selectOne("#viewAll");

  viewAllButton.hidden = true;
  products = HARDCODED_PRODUCTS.filter(hasRequiredProductFields);
  catalogLoaded = true;
  removeUnavailableCartItems();
  saveCart();
  renderProducts();
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
        <span class="product-badge">${product.badge}</span>
        <button class="quick-view" data-quick="${product.id}">Quick view</button>
      </div>
      <div class="product-info">
        <span class="product-type">${product.category.toUpperCase()}</span>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-bottom">
          <strong>${formatMoney(product.price)}</strong>
          <button
            class="add-button"
            data-add="${product.id}"
            aria-label="Add ${product.name} to cart"
          >+</button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();
  const visibleProducts = filteredProducts.slice(0, visibleProductCount);

  selectOne("#productGrid").innerHTML =
    visibleProducts.map(createProductCardMarkup).join("") ||
    "<p>No products found in this category.</p>";

  selectOne("#viewAll").hidden = visibleProductCount >= filteredProducts.length;
}

function findProduct(productId) {
  return products.find(function matchesProductId(product) {
    return product.id === String(productId);
  });
}

// Cart

function removeUnavailableCartItems() {
  if (!catalogLoaded) {
    return;
  }

  cart = cart.filter(function productStillExists(item) {
    return Boolean(findProduct(item.id));
  });
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  renderCart();
}

function addProductToCart(productId, quantity = 1) {
  const product = findProduct(productId);
  const safeQuantity = Math.max(1, Math.min(10, Number(quantity) || 1));

  if (!product) {
    return;
  }

  const existingItem = cart.find(function matchesCartItem(item) {
    return item.id === product.id;
  });

  if (existingItem) {
    existingItem.qty += safeQuantity;
  } else {
    cart.push({ id: product.id, qty: safeQuantity });
  }

  saveCart();
  showToast(`${product.name} added to your cart`);
}

function removeProductFromCart(productId) {
  cart = cart.filter(function keepsOtherItems(item) {
    return item.id !== productId;
  });
  saveCart();
}

function createEmptyCartMarkup() {
  return `
    <div class="empty-cart">
      <span>♡</span>
      <h3>Your cart is waiting.</h3>
      <p>Add something delightful and it will appear here.</p>
      <button class="text-link" data-close>Browse sweets →</button>
    </div>
  `;
}

function createCartItemMarkup(item) {
  const product = findProduct(item.id);

  return `
    <div class="cart-item">
      <img src="${product.image}" alt="">
      <div>
        <h3>${product.name}</h3>
        <small>${formatMoney(product.price)} × ${item.qty}</small>
        <button data-remove="${product.id}">Remove</button>
      </div>
      <strong>${formatMoney(product.price * item.qty)}</strong>
    </div>
  `;
}

function calculateCartSubtotal() {
  return cart.reduce(function addItemSubtotal(total, item) {
    const product = findProduct(item.id);
    return total + product.price * item.qty;
  }, 0);
}

function renderCart() {
  const totalQuantity = cart.reduce(function addItemQuantity(total, item) {
    return total + item.qty;
  }, 0);

  selectOne("#cartCount").textContent = totalQuantity;

  if (!catalogLoaded) {
    selectOne("#cartItems").innerHTML = "<p>Loading your cart…</p>";
    selectOne("#cartSubtotal").textContent = formatMoney(0);
    return;
  }

  removeUnavailableCartItems();
  selectOne("#cartItems").innerHTML = cart.length
    ? cart.map(createCartItemMarkup).join("")
    : createEmptyCartMarkup();
  selectOne("#cartSubtotal").textContent = formatMoney(calculateCartSubtotal());
}

function openCart() {
  selectOne("#cartDrawer").classList.add("open");
  selectOne("#cartDrawer").setAttribute("aria-hidden", "false");
  selectOne("#overlay").classList.add("show");
  document.body.classList.add("no-scroll");

  setTimeout(function focusCartCloseButton() {
    selectOne(".drawer-close").focus();
  }, 100);
}

function closeCart() {
  selectOne("#cartDrawer").classList.remove("open");
  selectOne("#cartDrawer").setAttribute("aria-hidden", "true");
  selectOne("#overlay").classList.remove("show");
  document.body.classList.remove("no-scroll");
}

// Shared UI feedback and dialogs

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
  if (!product) return;

  selectOne("#quickViewContent").innerHTML = `
    <div class="purchase-layout">
      <div class="purchase-gallery">
        <span class="product-badge">${product.badge}</span>
        <img src="${product.image}" alt="${product.name}">
        <p>Freshly prepared for your order</p>
      </div>
      <div class="purchase-details">
        <p class="eyebrow">${product.category}</p>
        <h2>${product.name}</h2>
        <div class="purchase-rating" aria-label="New product, no reviews yet"><span aria-hidden="true">☆ ☆ ☆ ☆ ☆</span><small>No reviews yet</small></div>
        <hr>
        <p class="purchase-price"><small>Price</small> ${formatMoney(product.price)}</p>
        <p class="purchase-tax">VAT included. Delivery is calculated at checkout.</p>
        <p class="purchase-description">${product.description}</p>
        <div class="purchase-perks"><span><b>✦</b><small>Freshly<br>prepared</small></span><span><b>⌂</b><small>Pickup or<br>delivery</small></span><span><b>♡</b><small>Gift-ready<br>packing</small></span></div>
        <details><summary>Product & allergen information</summary><p>Prepared in small batches. Please contact us before ordering if you have allergies or dietary requirements.</p></details>
      </div>
      <aside class="purchase-box" aria-label="Purchase options">
        <p class="purchase-box-price">${formatMoney(product.price)}</p>
        <p class="delivery-note"><b>Delivery details confirmed at checkout</b><br>Choose pickup or local delivery and your preferred schedule.</p>
        <p class="stock-status">In stock</p>
        <label for="purchaseQuantity">Quantity</label>
        <select id="purchaseQuantity" data-purchase-quantity>${[1,2,3,4,5,6,7,8,9,10].map((quantity) => `<option value="${quantity}">${quantity}</option>`).join("")}</select>
        <button class="purchase-action add-cart-action" data-modal-add="${product.id}">Add to cart</button>
        <button class="purchase-action buy-now-action" data-buy-now="${product.id}">Buy now</button>
        <dl class="purchase-meta"><div><dt>Ships from</dt><dd>e-Sweets</dd></div><div><dt>Sold by</dt><dd>e-Sweets</dd></div><div><dt>Payment</dt><dd>Secure checkout</dd></div></dl>
      </aside>
    </div>`;
  selectOne("#quickViewDialog").showModal();
}

function closeDialogFromButton(button) {
  const dialog = button.closest("dialog");
  dialog?.close();
}

// Product and cart event handlers

function handleProductGridClick(event) {
  const addButton = event.target.closest("[data-add]");
  const quickViewButton = event.target.closest("[data-quick]");

  if (addButton) {
    addProductToCart(addButton.dataset.add);
  }

  if (quickViewButton) {
    showProductQuickView(quickViewButton.dataset.quick);
  }
}

function handleProductFilterClick(event) {
  const filterButton = event.target.closest("[data-product-filter]");

  if (!filterButton) {
    return;
  }

  activeProductFilter = filterButton.dataset.productFilter;
  visibleProductCount = INITIAL_VISIBLE_PRODUCT_COUNT;

  selectAll(".filter-pills button").forEach(
    function updateFilterButton(button) {
      button.classList.toggle("active", button === filterButton);
    },
  );

  renderProducts();
}

function handleCategoryLinkClick(event) {
  activeProductFilter = event.currentTarget.dataset.filter;
  visibleProductCount = INITIAL_VISIBLE_PRODUCT_COUNT;

  selectAll(".filter-pills button").forEach(
    function updateFilterButton(button) {
      button.classList.toggle(
        "active",
        button.dataset.productFilter === activeProductFilter,
      );
    },
  );

  renderProducts();
}

function handleViewAllClick() {
  visibleProductCount = products.length;
  renderProducts();
}

function createCheckoutItemMarkup(item) {
  const product = findProduct(item.id);
  return `<div class="checkout-item"><img src="${product.image}" alt=""><span><b>${product.name}</b><small>Qty ${item.qty}</small></span><strong>${formatMoney(product.price * item.qty)}</strong></div>`;
}

function renderCheckoutSummary() {
  const subtotal = calculateCartSubtotal();
  selectOne("#checkoutItems").innerHTML = cart.map(createCheckoutItemMarkup).join("");
  selectOne("#checkoutSubtotal").textContent = formatMoney(subtotal);
  selectOne("#checkoutTotal").textContent = formatMoney(subtotal);
}

function handleCheckoutClick() {
  if (!cart.length) {
    showToast("Add a sweet before checking out.");
    return;
  }
  closeCart();
  selectOne("#checkoutForm").hidden = false;
  selectOne("#orderSuccess").hidden = true;
  selectOne("#checkoutMessage").textContent = "";
  const dateInput = selectOne('#checkoutForm input[name="date"]');
  dateInput.min = new Date().toISOString().split("T")[0];
  renderCheckoutSummary();
  selectOne("#checkoutDialog").showModal();
}

function handleFulfillmentChange(event) {
  if (event.target.name !== "fulfillment") return;
  const isDelivery = event.target.value === "delivery";
  const addressField = selectOne("#deliveryAddressField");
  addressField.hidden = !isDelivery;
  addressField.querySelector("textarea").required = isDelivery;
  selectOne("#checkoutDelivery").textContent = isDelivery ? "Confirmed later" : "Free";
}

function handleCheckoutSubmit(event) {
  event.preventDefault();
  if (!event.currentTarget.checkValidity()) {
    event.currentTarget.reportValidity();
    return;
  }
  const details = Object.fromEntries(new FormData(event.currentTarget));
  const reference = `ES-${Date.now().toString().slice(-8)}`;
  const order = { reference, createdAt: new Date().toISOString(), details, items: cart.map((item) => ({ ...item })), subtotal: calculateCartSubtotal(), status: "pending-confirmation" };
  const orders = JSON.parse(localStorage.getItem("esweets-orders") || "[]");
  orders.push(order);
  localStorage.setItem("esweets-orders", JSON.stringify(orders));
  cart = [];
  saveCart();
  event.currentTarget.reset();
  event.currentTarget.hidden = true;
  const success = selectOne("#orderSuccess");
  success.hidden = false;
  success.innerHTML = `<span>✓</span><p class="eyebrow">ORDER RECEIVED</p><h2>Thank you, ${details.name}!</h2><p>Your order request <strong>${reference}</strong> has been saved. The store will confirm availability, delivery fees, and schedule using your contact details.</p><button class="button button-dark" type="button" data-dialog-close>Continue shopping →</button>`;
}

function handleDocumentClick(event) {
  const closeCartButton = event.target.closest("[data-close]");
  const removeButton = event.target.closest("[data-remove]");
  const modalAddButton = event.target.closest("[data-modal-add]");
  const buyNowButton = event.target.closest("[data-buy-now]");
  const dialogCloseButton = event.target.closest("[data-dialog-close]");

  if (closeCartButton) {
    closeCart();
  }

  if (removeButton) {
    removeProductFromCart(removeButton.dataset.remove);
  }

  if (modalAddButton) {
    const quantity = selectOne("[data-purchase-quantity]")?.value || 1;
    addProductToCart(modalAddButton.dataset.modalAdd, quantity);
    selectOne("#quickViewDialog").close();
  }

  if (buyNowButton) {
    const quantity = selectOne("[data-purchase-quantity]")?.value || 1;
    addProductToCart(buyNowButton.dataset.buyNow, quantity);
    selectOne("#quickViewDialog").close();
    openCart();
  }

  if (dialogCloseButton) {
    closeDialogFromButton(dialogCloseButton);
  }

  if (
    selectOne("#navLinks").classList.contains("open") &&
    !event.target.closest("#navLinks") &&
    !event.target.closest("#menuToggle")
  ) {
    setMobileNavigation(false);
  }
}

// Header navigation

const navigationLinks = selectAll("#navLinks a[href^='#']");
const navigationSections = navigationLinks
  .map(function findNavigationSection(link) {
    return selectOne(link.hash);
  })
  .filter(Boolean);

let navigationTargetId = null;
let navigationUnlockTimer;
let navigationScrollFrame;

function setActiveNavigation(sectionId) {
  navigationLinks.forEach(function updateNavigationLink(link) {
    const isActive = link.hash === `#${sectionId}`;
    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function syncActiveNavigation() {
  if (navigationTargetId) {
    return;
  }

  const navigationMarker =
    window.scrollY + selectOne(".site-header").offsetHeight + 140;
  let currentSection = navigationSections[0];

  navigationSections.forEach(function findCurrentSection(section) {
    if (section.offsetTop <= navigationMarker) {
      currentSection = section;
    }
  });

  const isAtPageBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 2;

  if (isAtPageBottom) {
    currentSection = navigationSections.at(-1);
  }

  setActiveNavigation(currentSection.id);
}

function handleWindowScroll() {
  if (navigationScrollFrame) {
    return;
  }

  navigationScrollFrame = requestAnimationFrame(
    function updateNavigationOnFrame() {
      syncActiveNavigation();
      navigationScrollFrame = null;
    },
  );
}

function unlockNavigationTracking() {
  if (!navigationTargetId) {
    return;
  }

  clearTimeout(navigationUnlockTimer);
  navigationTargetId = null;
  syncActiveNavigation();
}

function setMobileNavigation(isOpen) {
  selectOne("#navLinks").classList.toggle("open", isOpen);
  selectOne("#menuToggle").setAttribute("aria-expanded", String(isOpen));
  selectOne("#menuToggle").setAttribute(
    "aria-label",
    isOpen ? "Close menu" : "Open menu",
  );
  document.body.classList.toggle("nav-open", isOpen);
}

function handleMenuToggleClick(event) {
  event.stopPropagation();
  const isOpen = selectOne("#navLinks").classList.contains("open");
  setMobileNavigation(!isOpen);
}

function handleNavigationLinkClick(event) {
  navigationTargetId = event.currentTarget.hash.slice(1);
  setActiveNavigation(navigationTargetId);
  clearTimeout(navigationUnlockTimer);

  navigationUnlockTimer = setTimeout(function resumeNavigationTracking() {
    navigationTargetId = null;
    syncActiveNavigation();
  }, 1200);

  setMobileNavigation(false);
}

function handleWindowResize() {
  if (window.innerWidth > 1020) {
    setMobileNavigation(false);
  }
}

function handleAnnouncementClose() {
  selectOne("#announcement").remove();
}

function updateAccountLink(user) {
  const accountLink = selectOne(".account-link");
  accountLink.href = user ? "account.html" : "login.html";
  accountLink.setAttribute(
    "aria-label",
    user ? "Open customer account" : "Log in to your account",
  );
}

// Search

function openSearchPanel() {
  selectOne("#searchPanel").hidden = false;
  document.body.classList.add("no-scroll");

  setTimeout(function focusSearchInput() {
    selectOne("#searchInput").focus();
  }, 50);
}

function closeSearchPanel() {
  selectOne("#searchPanel").hidden = true;
  document.body.classList.remove("no-scroll");
}

function productMatchesSearch(product, normalizedQuery) {
  const searchableText = [product.name, product.category, product.description]
    .join(" ")
    .toLowerCase();
  return searchableText.includes(normalizedQuery);
}

function createSearchResultMarkup(product) {
  return `
    <button type="button" data-search-id="${product.id}">
      <strong>${product.name}</strong> · ${formatMoney(product.price)}
    </button>
  `;
}

function runProductSearch(query) {
  const normalizedQuery = query.toLowerCase();
  const matchingProducts = products.filter(function matchesQuery(product) {
    return productMatchesSearch(product, normalizedQuery);
  });
  const searchResults = selectOne("#searchResults");

  searchResults.className = "search-result-list";

  if (!query) {
    searchResults.innerHTML = "";
    return;
  }

  searchResults.innerHTML = matchingProducts.length
    ? matchingProducts.map(createSearchResultMarkup).join("")
    : "<p>No sweets found. Try cake, cookie or pastry.</p>";
}

function handleSearchInput(event) {
  runProductSearch(event.target.value.trim());
}

function handleSearchSubmit(event) {
  event.preventDefault();
  runProductSearch(selectOne("#searchInput").value.trim());
}

function handleSearchResultClick(event) {
  const resultButton = event.target.closest("[data-search-id]");

  if (!resultButton) {
    return;
  }

  closeSearchPanel();
  showProductQuickView(resultButton.dataset.searchId);
}

// Forms

function handleNewsletterSubmit(event) {
  event.preventDefault();
  const emailInput = selectOne("#newsletterEmail");
  const message = selectOne("#newsletterMessage");

  if (!emailInput.validity.valid) {
    message.textContent = "Please enter a valid email address.";
    emailInput.focus();
    return;
  }

  localStorage.setItem("esweets-newsletter-email", emailInput.value);
  message.textContent = "You’re on the list — thank you!";
  event.currentTarget.reset();
}

function openCustomOrderDialog() {
  selectOne("#customOrderDialog").showModal();
}

function handleCustomOrderSubmit(event) {
  event.preventDefault();

  if (!event.currentTarget.checkValidity()) {
    event.currentTarget.reportValidity();
    return;
  }

  const customOrderDraft = Object.fromEntries(
    new FormData(event.currentTarget),
  );
  localStorage.setItem(
    "esweets-custom-draft",
    JSON.stringify(customOrderDraft),
  );
  selectOne("#customMessage").textContent =
    "Draft saved. Backend submission will be enabled when connected.";
  showToast("Custom order draft saved");
}

function openContactDialog() {
  selectOne("#contactDialog").showModal();
}

function handleContactSubmit(event) {
  event.preventDefault();

  if (!event.currentTarget.checkValidity()) {
    event.currentTarget.reportValidity();
    return;
  }

  const concernDraft = Object.fromEntries(new FormData(event.currentTarget));
  localStorage.setItem("esweets-contact-draft", JSON.stringify(concernDraft));
  selectOne("#contactMessage").textContent =
    "Concern saved as a draft on this device.";
  showToast("Concern draft saved");
}

// Global keyboard handling

function handleDocumentKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  setMobileNavigation(false);
  closeCart();

  if (!selectOne("#searchPanel").hidden) {
    closeSearchPanel();
  }
}

// Event registration and startup

function registerEventListeners() {
  selectOne("#productGrid").addEventListener("click", handleProductGridClick);
  selectOne(".filter-pills").addEventListener(
    "click",
    handleProductFilterClick,
  );
  selectAll("[data-filter]").forEach(function registerCategoryLink(link) {
    link.addEventListener("click", handleCategoryLinkClick);
  });
  selectOne("#viewAll").addEventListener("click", handleViewAllClick);
  selectOne("#cartOpen").addEventListener("click", openCart);
  selectOne("#overlay").addEventListener("click", closeCart);
  selectOne("#checkoutButton").addEventListener("click", handleCheckoutClick);
  selectOne("#checkoutForm").addEventListener("change", handleFulfillmentChange);
  selectOne("#checkoutForm").addEventListener("submit", handleCheckoutSubmit);

  selectOne("#menuToggle").addEventListener("click", handleMenuToggleClick);
  navigationLinks.forEach(function registerNavigationLink(link) {
    link.addEventListener("click", handleNavigationLinkClick);
  });
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  window.addEventListener("scrollend", unlockNavigationTracking);
  window.addEventListener("resize", handleWindowResize);
  selectOne("#closeAnnouncement").addEventListener(
    "click",
    handleAnnouncementClose,
  );

  selectOne("#searchOpen").addEventListener("click", openSearchPanel);
  selectOne("#searchClose").addEventListener("click", closeSearchPanel);
  selectOne("#searchInput").addEventListener("input", handleSearchInput);
  selectOne("#searchForm").addEventListener("submit", handleSearchSubmit);
  selectOne("#searchResults").addEventListener(
    "click",
    handleSearchResultClick,
  );

  selectOne("#newsletterForm").addEventListener(
    "submit",
    handleNewsletterSubmit,
  );
  selectOne("#customOrderOpen").addEventListener(
    "click",
    openCustomOrderDialog,
  );
  selectOne("#customForm").addEventListener("submit", handleCustomOrderSubmit);
  selectOne("#contactOpen").addEventListener("click", openContactDialog);
  selectOne("#contactForm").addEventListener("submit", handleContactSubmit);

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
}

function initializeStorefront() {
  selectOne("#year").textContent = new Date().getFullYear();
  registerEventListeners();
  syncActiveNavigation();
  renderCart();
  watchAuthState(updateAccountLink);
  loadProducts();
}

initializeStorefront();

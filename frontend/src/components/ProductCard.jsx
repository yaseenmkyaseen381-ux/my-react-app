import { Link } from "react-router-dom";

function ProductArtwork({ product }) {
  if (product.image)
    return (
      <img
        className="product-photo"
        src={product.image}
        alt={`${product.name} product photo`}
        loading="lazy"
      />
    );
  const type = product.category.toLowerCase();
  if (type === "phones" || type === "tablets")
    return (
      <div
        className={`product-artwork artwork-${type} ${product.id}`}
        aria-hidden="true"
      >
        <div className="art-device" />
        <i className="art-glint" />
      </div>
    );
  if (type === "laptops")
    return (
      <div
        className={`product-artwork artwork-laptops ${product.id}`}
        aria-hidden="true"
      >
        <div className="art-device" />
        <i className="art-base" />
      </div>
    );
  if (type === "audio")
    return (
      <div className="product-artwork artwork-audio" aria-hidden="true">
        <div className="art-device" />
        <i className="art-ear art-ear-left" />
        <i className="art-ear art-ear-right" />
      </div>
    );
  if (type === "wearables")
    return (
      <div className="product-artwork artwork-wearables" aria-hidden="true">
        <i className="art-strap" />
        <div className="art-device">◷</div>
      </div>
    );
  return (
    <div
      className={`product-artwork artwork-fallback ${product.id}`}
      aria-hidden="true"
    >
      <b>{product.icon}</b>
    </div>
  );
}

export default function ProductCard({
  product,
  saved = false,
  onToggleSaved,
  onAddToBag,
}) {
  const outOfStock = product.stock === 0;
  return (
    <article className="product" key={product.id}>
      <div
        className={`product-picture product-${product.category.toLowerCase()} ${outOfStock ? "product-out-of-stock" : ""}`}
      >
        <span className="product-tag">
          {outOfStock ? "OUT OF STOCK" : product.tag}
        </span>
        <Link
          className="product-image-link"
          to={`/products/${product.id}`}
          aria-label={`View ${product.name}`}
        >
          <ProductArtwork product={product} />
        </Link>
        {onToggleSaved && (
          <button
            className={`save-button ${saved ? "is-saved" : ""}`}
            aria-label={`${saved ? "Remove" : "Save"} ${product.name}`}
            onClick={() => onToggleSaved(product)}
          >
            <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
          </button>
        )}
      </div>
      <small>{product.category}</small>
      <h3>
        <Link to={`/products/${product.id}`}>{product.name}</Link>
      </h3>
      <p className="product-detail">{product.detail}</p>
      <div className="price-row">
        <b>{`₹${product.price.toLocaleString("en-IN")}`}</b>
        <del>{`₹${product.oldPrice.toLocaleString("en-IN")}`}</del>
      </div>
      {product.variants?.length ? (
        <Link className="outline-btn" to={`/products/${product.id}`}>
          Choose options <span aria-hidden="true">›</span>
        </Link>
      ) : (
        <button
          className="outline-btn"
          disabled={outOfStock}
          onClick={() => onAddToBag(product)}
        >
          {outOfStock ? "Out of stock" : "Add to cart"}{" "}
          <svg
            className="cart-action-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 4h2l2.15 11.2a2 2 0 0 0 1.97 1.62h8.54a2 2 0 0 0 1.94-1.5L21 8H6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 11h8M10 8v6M15 8v6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="10" cy="20" r="1.35" fill="currentColor" />
            <circle cx="18" cy="20" r="1.35" fill="currentColor" />
          </svg>
        </button>
      )}
    </article>
  );
}

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import ProductCard from "../components/ProductCard";
import { addProductToCart } from "../cart";
import { getCategories, getProducts } from "../api";
import { loadWishlist, toggleWishlist } from "../wishlist";
import "./Catalog.css";

const PAGE_SIZE = 8;

export default function Products() {
  const location = useLocation();
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get("q") || "");
  const [category, setCategory] = useState(() => new URLSearchParams(location.search).get("category") || "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("q") || "");
    setCategory(params.get("category") || "");
    setPage(1);
  }, [location.search]);

  useEffect(() => {
    let active = true;
    getCategories().then(({ categories: data }) => { if (active) setCategories(data || []); }).catch(() => {});
    loadWishlist().then((ids) => { if (active) setWishlist(ids); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      getProducts({ page, limit: PAGE_SIZE, search, category, minPrice, maxPrice, sort })
        .then((result) => {
          if (!active) return;
          setProducts(result.products || []);
          setPagination({ page: result.page, total: result.total, totalPages: Math.max(1, result.totalPages) });
          setError("");
        })
        .catch((requestError) => { if (active) setError(requestError.message || "Could not load products."); })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [page, search, category, minPrice, maxPrice, sort]);

  const updateFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const addToCart = async (product) => {
    try {
      const result = await addProductToCart(product.id);
      if (result.wishlistUpdated) setWishlist((ids) => ids.filter((id) => id !== product.id));
      setNotice(result.wishlistUpdated ? `${product.name} added to cart and removed from wishlist.` : `${product.name} added to cart. Wishlist could not sync; try removing it again.`);
    }
    catch (requestError) { setNotice(requestError.message || "Could not verify stock."); }
  };
  const changeWishlist = async (product) => {
    try { setWishlist(await toggleWishlist(product.id)); }
    catch (requestError) { setNotice(requestError.message || "Could not update wishlist."); }
  };
  const clearFilters = () => { setSearch(""); setCategory(""); setMinPrice(""); setMaxPrice(""); setSort("newest"); setPage(1); };

  return <>
    <SiteHeader />
    <main className="catalog-page">
      <p className="catalog-breadcrumb"><Link to="/home">Home</Link> / Products</p>
      <div className="catalog-title"><div><span className="eyebrow">MOBIX STORE</span><h1>All products</h1><p>Search and filter the current product catalogue.</p></div><Link className="catalog-cart-link" to="/wishlist">Wishlist</Link></div>
      <section className="catalog-filters" aria-label="Product search and filters">
        <label className="catalog-search"><span aria-hidden="true">⌕</span><input value={search} onChange={updateFilter(setSearch)} placeholder="Search products" aria-label="Search products" /></label>
        <label><span>Category</span><select value={category} onChange={updateFilter(setCategory)}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.parentName ? `${item.parentName} / ${item.name}` : item.name}</option>)}</select></label>
        <label><span>Minimum price (₹)</span><input type="number" min="0" value={minPrice} onChange={updateFilter(setMinPrice)} placeholder="No minimum" /></label>
        <label><span>Maximum price (₹)</span><input type="number" min="0" value={maxPrice} onChange={updateFilter(setMaxPrice)} placeholder="No maximum" /></label>
        <label><span>Sort by</span><select value={sort} onChange={updateFilter(setSort)}><option value="newest">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name-az">Name: A–Z</option><option value="name-za">Name: Z–A</option></select></label>
        <button className="catalog-clear" onClick={clearFilters}>Clear filters</button>
      </section>
      <div className="catalog-result-count">Showing {pagination.total ? (pagination.page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(pagination.page * PAGE_SIZE, pagination.total)} of {pagination.total} products</div>
      {error && <div className="catalog-error" role="alert">{error}</div>}
      {loading ? <div className="catalog-loading" role="status">Loading products…</div> : products.length ? <div className="product-grid catalog-grid">{products.map((product) => <ProductCard key={product.id} product={product} saved={wishlist.includes(product.id)} onToggleSaved={changeWishlist} onAddToBag={addToCart} />)}</div> : !error && <div className="empty-results"><h3>No matching products</h3><p>Try another search or widen the price range.</p><p>If you just added this product in Admin, publish it and make sure stock is above 0.</p></div>}
      {!loading && pagination.totalPages > 1 && <nav className="catalog-pagination" aria-label="Product pages"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page {page} of {pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}>Next →</button></nav>}
    </main>
    <footer className="catalog-footer"><Link to="/home">← Return to MOBIX</Link></footer>
    {notice && <div className="toast" role="status">{notice}</div>}
  </>;
}

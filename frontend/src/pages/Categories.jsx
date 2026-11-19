import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import CategoryArtwork from "../components/CategoryArtwork";
import { getCategories, getProducts } from "../api";
import "./Catalog.css";
import "./Categories.css";

const categoryDefinitions = [
  { name: "Smartphones", filter: "phones", aliases: ["smartphone", "smartphones", "mobile", "mobiles", "phone", "phones"], description: "Everyday phones and the latest upgrades." },
  { name: "Laptops", filter: "laptops", aliases: ["laptop", "laptops"], description: "Devices for work, study, and creative projects." },
  { name: "Tablets", filter: "tablets", aliases: ["tablet", "tablets"], description: "Big screens for reading, streaming, and more." },
  { name: "Audio", filter: "audio", aliases: ["audio"], description: "Earbuds, headphones, and wireless audio for every day." },
  { name: "Accessories", filter: "accessories", aliases: ["accessory", "accessories"], description: "Chargers, hubs, and other everyday essentials." },
];

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function CategoryImage({ type, image, name }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return <CategoryArtwork type={type} />;
  return <img className="category-photo" src={image} alt={`${name} product`} loading="lazy" onError={() => setFailed(true)} />;
}

export default function Categories() {
  const [products, setProducts] = useState([]);
  const [categoryRows, setCategoryRows] = useState([]);
  useEffect(() => {
    let active = true;
    getProducts({ page: 1, limit: 50, sort: "newest" })
      .then((result) => { if (active) setProducts(result.products || []); })
      .catch(() => {});
    getCategories()
      .then(({ categories: rows }) => { if (active) setCategoryRows(rows || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const categories = categoryDefinitions.map((definition) => {
    const actualCategory = definition.aliases
      .map((alias) => categoryRows.find((row) => normalize(row.id) === alias || normalize(row.name) === alias))
      .find(Boolean);
    const filter = actualCategory?.id || definition.filter;
    return { ...definition, name: actualCategory?.name || definition.name, filter, children: categoryRows.filter((row) => row.parentId === filter) };
  });
  const knownCategoryIds = new Set(categories.map(({ filter }) => normalize(filter)));
  const extraCategories = categoryRows
    .filter((row) => !row.parentId && !knownCategoryIds.has(normalize(row.id)) && !categoryDefinitions.some(({ aliases }) => aliases.includes(normalize(row.name))))
    .map((row) => ({ name: row.name, filter: row.id, description: `Explore products in ${row.name}.` }));
  const visibleCategories = [...categories, ...extraCategories];

  return <>
    <SiteHeader />
    <main className="catalog-page categories-page">
      <p className="catalog-breadcrumb"><Link to="/home">Home</Link> / Categories</p>
      <div className="catalog-title"><div><span className="eyebrow">EXPLORE MOBIX</span><h1>Shop by category</h1><p>Choose a category to find the tech you need.</p></div></div>
      <div className="categories-grid">
        {visibleCategories.map(({ name, filter, description, children = [] }) => {
          const childIds = new Set(children.map((child) => child.id));
          const imageProduct = products.find((product) => product.categoryId === filter && product.image)
            || products.find((product) => childIds.has(product.categoryId) && product.image)
            || (filter === "audio" ? products.find((product) => /earbud|buds|headphone/i.test(product.name) && product.image) : null);
          const image = imageProduct?.image || (filter === "audio" ? "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=82" : "");
          return <article className="category-tile" key={filter}>
          <CategoryImage type={filter} name={name} image={image} />
          <span className="category-tile-copy"><b>{name}</b><small>{description}</small>{children.length > 0 && <span className="category-subcategory-links" aria-label={`${name} subcategories`}>{children.map((child) => <Link to={`/products?category=${child.id}`} key={child.id}>{child.name}</Link>)}</span>}<Link className="category-tile-action" to={`/products?category=${filter}`}>Browse category <span aria-hidden="true">→</span></Link></span>
        </article>;
        })}
      </div>
    </main>
  </>;
}

export default function CategoryArtwork({ type }) {
  const gradientId = `category-${type}-gradient`;
  return <svg className="category-artwork" viewBox="0 0 180 100" role="img" aria-label={`${type} illustration`} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={gradientId} x1="18" y1="8" x2="162" y2="96" gradientUnits="userSpaceOnUse"><stop stopColor="#F9FBFF"/><stop offset="1" stopColor="#E3ECFA"/></linearGradient>
      <linearGradient id={`${gradientId}-device`} x1="65" y1="17" x2="119" y2="88" gradientUnits="userSpaceOnUse"><stop stopColor="#89BDF5"/><stop offset="1" stopColor="#4168AE"/></linearGradient>
    </defs>
    <rect width="180" height="100" rx="12" fill={`url(#${gradientId})`}/>
    <circle cx="90" cy="50" r="35" fill="#fff" fillOpacity=".48"/>
    {type === "phones" && <g><rect x="69" y="12" width="42" height="76" rx="10" fill="#26364F"/><rect x="73" y="17" width="34" height="65" rx="7" fill={`url(#${gradientId}-device)`}/><path d="M80 24h20v40a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V24Z" fill="#FFFFFF" fillOpacity=".2"/><circle cx="90" cy="76" r="2" fill="#EAF3FF"/></g>}
    {type === "laptops" && <g><rect x="54" y="18" width="72" height="50" rx="5" fill="#34445E"/><rect x="58" y="22" width="64" height="42" rx="3" fill={`url(#${gradientId}-device)`}/><path d="M47 70h86l8 8c1 2 0 4-3 4H42c-3 0-4-2-3-4l8-8Z" fill="#8796AD"/><path d="M78 72h24l-2 3H80l-2-3Z" fill="#DDE6F2"/></g>}
    {type === "tablets" && <g><rect x="53" y="17" width="74" height="66" rx="8" fill="#34445E"/><rect x="58" y="22" width="64" height="56" rx="5" fill={`url(#${gradientId}-device)`}/><path d="M64 68c16-20 27-17 40-3 6-11 12-16 18-17v30H58V70l6-2Z" fill="#EAF4FF" fillOpacity=".62"/><circle cx="90" cy="80" r="1.5" fill="#E8F0FC"/></g>}
    {type === "audio" && <g><path d="M57 57V48a33 33 0 0 1 66 0v9" stroke="#35455F" strokeWidth="9" strokeLinecap="round"/><rect x="49" y="48" width="20" height="34" rx="9" fill={`url(#${gradientId}-device)`}/><rect x="111" y="48" width="20" height="34" rx="9" fill={`url(#${gradientId}-device)`}/><rect x="53" y="52" width="12" height="25" rx="6" fill="#A9D5FF" fillOpacity=".8"/><rect x="115" y="52" width="12" height="25" rx="6" fill="#A9D5FF" fillOpacity=".8"/></g>}
    {type === "wearables" && <g><rect x="73" y="9" width="34" height="82" rx="16" fill="#596A86"/><rect x="78" y="14" width="24" height="72" rx="12" fill="#9CB0CC"/><rect x="63" y="30" width="54" height="42" rx="12" fill="#283850"/><rect x="67" y="34" width="46" height="34" rx="9" fill={`url(#${gradientId}-device)`}/><path d="M90 40v9l7 4" stroke="#F6FAFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></g>}
    {type === "accessories" && <g><rect x="58" y="38" width="64" height="44" rx="17" fill="#FFFFFF" stroke="#526783" strokeWidth="3"/><path d="M61 57h58" stroke="#D0DBEA" strokeWidth="2"/><path d="M77 29v20" stroke="#33445E" strokeWidth="8" strokeLinecap="round"/><rect x="72" y="43" width="10" height="17" rx="5" fill={`url(#${gradientId}-device)`}/><path d="M103 29v20" stroke="#33445E" strokeWidth="8" strokeLinecap="round"/><rect x="98" y="43" width="10" height="17" rx="5" fill={`url(#${gradientId}-device)`}/><circle cx="90" cy="69" r="2" fill="#7891B7"/></g>}
  </svg>;
}

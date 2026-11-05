import { Store } from "@/components/store";
import { readCatalog } from "@/lib/catalog";
import { findPhotos } from "@/lib/photos";

export default function Home() {
  const { products } = readCatalog();
  return <Store products={products} photos={findPhotos(products)} />;
}

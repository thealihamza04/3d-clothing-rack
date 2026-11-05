"use client";

import { createContext, useContext } from "react";
import type { Photos } from "@/lib/products";

const PhotosContext = createContext<Photos>({});

export const PhotosProvider = PhotosContext.Provider;

export function usePhotos(slug: string) {
  return useContext(PhotosContext)[slug] ?? {};
}

import { useState, useEffect, useCallback } from 'react';
import { ServiceCategory, BlogCategory, Service, Blog, Review } from '../types';
import {
  CATALOG_CACHE_KEYS,
  getCachedCatalog,
  setCachedCatalog,
  fetchAllCatalogsWithCache,
  fetchReviewsWithCache,
  invalidateReviewsCache,
  AllCatalogs
} from '../services/catalogService';

/**
 * Validates and normalizes service categories, ensuring valid ID, name, slug, and status.
 */
export function validateAndNormalizeCategories(cats: unknown): ServiceCategory[] {
  if (!Array.isArray(cats)) return [];
  const seenIds = new Set<string>();
  const normalized: ServiceCategory[] = [];

  for (const cat of cats) {
    if (!cat || typeof cat !== 'object') continue;
    const rawId = String(cat.id || '').trim();
    const rawName = String(cat.name || '').trim();
    if (!rawId && !rawName) continue;

    const id = rawId || rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const slug = String(cat.slug || '').trim() || id.toLowerCase();
    const status = cat.status === 'Inactive' ? 'Inactive' : 'Active';

    normalized.push({
      id,
      name: rawName || id,
      slug,
      icon: typeof cat.icon === 'string' && cat.icon.trim() ? cat.icon.trim() : 'Folder',
      description: typeof cat.description === 'string' ? cat.description.trim() : '',
      status,
      sortOrder: typeof cat.sortOrder === 'number' && !isNaN(cat.sortOrder) ? cat.sortOrder : (typeof cat.order === 'number' ? cat.order : (normalized.length + 1))
    });
  }

  return normalized;
}

/**
 * Validates and normalizes blog categories, ensuring valid ID, name, slug, and status.
 */
export function validateAndNormalizeBlogCategories(blogCats: unknown): BlogCategory[] {
  if (!Array.isArray(blogCats)) return [];
  const seenIds = new Set<string>();
  const normalized: BlogCategory[] = [];

  for (const bCat of blogCats) {
    if (!bCat || typeof bCat !== 'object') continue;
    const rawId = String(bCat.id || '').trim();
    const rawName = String(bCat.name || '').trim();
    if (!rawId && !rawName) continue;

    const id = rawId || rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const slug = String(bCat.slug || '').trim() || id.toLowerCase();
    const status = bCat.status === 'Inactive' ? 'Inactive' : 'Active';

    normalized.push({
      id,
      name: rawName || id,
      slug,
      description: typeof bCat.description === 'string' ? bCat.description.trim() : '',
      status,
      sortOrder: typeof bCat.sortOrder === 'number' && !isNaN(bCat.sortOrder) ? bCat.sortOrder : (typeof bCat.order === 'number' ? bCat.order : (normalized.length + 1))
    });
  }

  return normalized;
}

/**
 * Validates and normalizes services, strictly matching and fixing category associations
 * to prevent orphan services or mis-categorization drift.
 */
export function validateAndNormalizeServices(
  servs: unknown,
  availableCategories: ServiceCategory[] = []
): Service[] {
  if (!Array.isArray(servs)) return [];
  const seenIds = new Set<string>();
  const normalized: Service[] = [];

  // Build lookup maps for categories: by id, by slug, and by name
  const catById = new Map<string, ServiceCategory>();
  const catBySlug = new Map<string, ServiceCategory>();
  const catByName = new Map<string, ServiceCategory>();

  for (const c of availableCategories) {
    if (c.id) catById.set(c.id.toLowerCase(), c);
    if (c.slug) catBySlug.set(c.slug.toLowerCase(), c);
    if (c.name) catByName.set(c.name.toLowerCase(), c);
  }

  // Fallback category if available
  const defaultCategory =
    availableCategories.find(c => (c.status || 'Active') === 'Active') ||
    availableCategories[0] ||
    null;

  for (const item of servs) {
    if (!item || typeof item !== 'object') continue;

    const rawTitle = String(item.title || item.name || '').trim();
    const rawId = String(item.id || '').trim();
    if (!rawId && !rawTitle) continue;

    const id = rawId || rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    // Resolve Category Association
    const rawCatId = String(item.categoryId || item.category || '').trim();
    let matchedCategory: ServiceCategory | null = null;

    if (rawCatId) {
      const lowerRawCat = rawCatId.toLowerCase();
      matchedCategory =
        catById.get(lowerRawCat) ||
        catBySlug.get(lowerRawCat) ||
        catByName.get(lowerRawCat) ||
        null;
    }

    let finalCategoryId = matchedCategory ? matchedCategory.id : rawCatId;

    // If categories are loaded and no category matched, map to default category
    if (!matchedCategory && defaultCategory && availableCategories.length > 0) {
      finalCategoryId = defaultCategory.id;
    }

    // Required documents normalization
    let requiredDocs: string[] = [];
    if (Array.isArray(item.requiredDocuments)) {
      requiredDocs = item.requiredDocuments.map((d: any) => String(d).trim()).filter(Boolean);
    } else if (typeof item.requiredDocuments === 'string' && item.requiredDocuments.trim()) {
      requiredDocs = item.requiredDocuments.split(',').map((d: string) => d.trim()).filter(Boolean);
    }

    // Highlights array normalization
    let highlights: string[] = [];
    if (Array.isArray(item.highlights)) {
      highlights = item.highlights.map((h: any) => String(h).trim()).filter(Boolean);
    }

    // Numeric pricing sanitization
    const govFees = typeof item.govFees === 'number' && !isNaN(item.govFees) ? Math.max(0, item.govFees) : 0;
    const serviceCharge = typeof item.serviceCharge === 'number' && !isNaN(item.serviceCharge) ? Math.max(0, item.serviceCharge) : 0;

    const desc = String(item.description || item.shortDescription || item.fullDescription || '').trim();
    const shortDesc = String(item.shortDescription || (desc.length > 160 ? desc.slice(0, 160) + '...' : desc)).trim();
    const fullDesc = String(item.fullDescription || desc).trim();
    const status = (item.status === 'inactive' || item.status === 'draft' || item.status === 'archived') ? item.status : 'active';
    const image = String(item.imageUrl || item.bannerImage || item.image || '').trim();

    normalized.push({
      ...item,
      id,
      title: rawTitle || 'Untitled Service',
      categoryId: finalCategoryId,
      subCategory: item.subCategory ? String(item.subCategory).trim() : undefined,
      description: desc || shortDesc,
      shortDescription: shortDesc,
      fullDescription: fullDesc,
      bannerImage: image,
      imageUrl: image,
      image: image,
      govFees,
      serviceCharge,
      processingTime: String(item.processingTime || item.estimatedTime || '3-5 Working Days').trim(),
      eligibility: String(item.eligibility || 'All eligible Indian citizens and businesses').trim(),
      requiredDocuments: requiredDocs,
      highlights: highlights.length > 0 ? highlights : ['100% Online Assistance', 'Document Verification', 'WhatsApp Guidance'],
      whatsAppEnabled: item.whatsAppEnabled !== false,
      seoTitle: String(item.seoTitle || rawTitle).trim(),
      seoDescription: String(item.seoDescription || shortDesc).trim(),
      slug: String(item.slug || id).trim(),
      status,
      featured: !!item.featured,
      popular: !!item.popular
    });
  }

  return normalized;
}

/**
 * Validates and normalizes blogs, ensuring categoryId and category name strictly align
 * with blogCategories to prevent mis-categorization drift.
 */
export function validateAndNormalizeBlogs(
  blogs: unknown,
  availableBlogCategories: BlogCategory[] = []
): Blog[] {
  if (!Array.isArray(blogs)) return [];
  const seenIds = new Set<string>();
  const normalized: Blog[] = [];

  // Build lookup maps for blog categories: by id, by slug, and by name
  const catById = new Map<string, BlogCategory>();
  const catBySlug = new Map<string, BlogCategory>();
  const catByName = new Map<string, BlogCategory>();

  for (const c of availableBlogCategories) {
    if (c.id) catById.set(c.id.toLowerCase(), c);
    if (c.slug) catBySlug.set(c.slug.toLowerCase(), c);
    if (c.name) catByName.set(c.name.toLowerCase(), c);
  }

  // Fallback category if available
  const defaultCategory =
    availableBlogCategories.find(c => (c.status || 'Active') === 'Active') ||
    availableBlogCategories[0] ||
    null;

  for (const item of blogs) {
    if (!item || typeof item !== 'object') continue;

    const rawTitle = String(item.title || '').trim();
    const rawId = String(item.id || '').trim();
    if (!rawId && !rawTitle) continue;

    const id = rawId || rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    // Resolve Category Association
    const rawCatId = String(item.categoryId || '').trim();
    const rawCatName = String(item.category || '').trim();

    let matchedCategory: BlogCategory | null = null;

    if (rawCatId) {
      const lowerRawCat = rawCatId.toLowerCase();
      matchedCategory =
        catById.get(lowerRawCat) ||
        catBySlug.get(lowerRawCat) ||
        catByName.get(lowerRawCat) ||
        null;
    }

    if (!matchedCategory && rawCatName) {
      const lowerRawName = rawCatName.toLowerCase();
      matchedCategory =
        catByName.get(lowerRawName) ||
        catBySlug.get(lowerRawName) ||
        catById.get(lowerRawName) ||
        null;
    }

    let finalCategoryId = matchedCategory ? matchedCategory.id : (rawCatId || (defaultCategory ? defaultCategory.id : ''));
    let finalCategoryName = matchedCategory ? matchedCategory.name : (rawCatName || (defaultCategory ? defaultCategory.name : 'General'));

    // If blog categories are loaded and no category matched, map to default category
    if (!matchedCategory && defaultCategory && availableBlogCategories.length > 0) {
      finalCategoryId = defaultCategory.id;
      finalCategoryName = defaultCategory.name;
    }

    // Tags normalization
    let tags: string[] = [];
    if (Array.isArray(item.tags)) {
      tags = item.tags.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (typeof item.tags === 'string' && item.tags.trim()) {
      tags = item.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
    if (tags.length === 0) {
      tags = [finalCategoryName || 'Guide'];
    }

    const content = String(item.content || '').trim();
    const excerpt = String(item.excerpt || item.shortDescription || (content.length > 160 ? content.slice(0, 160) + '...' : content)).trim();
    const image = String(item.imageUrl || item.image || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400').trim();
    const author = String(item.author || 'EasyDesk Editorial Team').trim();
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readTime = String(item.readTime || `${Math.max(2, Math.ceil(wordCount / 200))} min read`).trim();
    const date = item.date || new Date().toISOString().slice(0, 10);
    const status = (item.status === 'draft' || item.status === 'archived' || item.status === 'scheduled') ? item.status : 'published';

    normalized.push({
      ...item,
      id,
      title: rawTitle || 'Untitled Blog Article',
      categoryId: finalCategoryId,
      category: finalCategoryName,
      content,
      excerpt,
      imageUrl: image,
      image: image,
      author,
      readTime,
      date,
      tags,
      seoTitle: String(item.seoTitle || rawTitle).trim(),
      seoDescription: String(item.seoDescription || excerpt).trim(),
      focusKeywords: String(item.focusKeywords || '').trim(),
      slug: String(item.slug || id).trim(),
      status,
      commentsEnabled: item.commentsEnabled !== false,
      featured: !!item.featured
    });
  }

  return normalized;
}

/**
 * Validates and normalizes reviews.
 */
export function validateAndNormalizeReviews(revs: unknown): Review[] {
  if (!Array.isArray(revs)) return [];
  const seenIds = new Set<string>();
  const normalized: Review[] = [];

  for (const item of revs) {
    if (!item || typeof item !== 'object') continue;
    const rawId = String(item.id || '').trim();
    const name = String(item.name || item.author || 'Verified Citizen').trim();
    const comment = String(item.comment || item.text || '').trim();
    if (!rawId && !comment) continue;

    const id = rawId || `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const rawRating = Number(item.rating);
    const rating = isNaN(rawRating) ? 5 : Math.max(1, Math.min(5, Math.round(rawRating)));
    const status = item.status === 'rejected' || item.status === 'pending' ? item.status : 'approved';

    normalized.push({
      ...item,
      id,
      name,
      rating,
      comment,
      serviceId: item.serviceId ? String(item.serviceId).trim() : undefined,
      serviceTitle: item.serviceTitle ? String(item.serviceTitle).trim() : undefined,
      date: item.date || new Date().toISOString().slice(0, 10),
      status,
      verified: item.verified !== false
    });
  }

  return normalized;
}

export interface UseCatalogReturn {
  categories: ServiceCategory[];
  blogCategories: BlogCategory[];
  services: Service[];
  blogs: Blog[];
  reviews: Review[];
  loading: boolean;
  isUsingCache: boolean;
  error: string | null;
  refetchAll: () => Promise<AllCatalogs>;
  refetchReviews: () => Promise<Review[]>;
  updateCategories: (cats: ServiceCategory[]) => void;
  updateBlogCategories: (blogCats: BlogCategory[]) => void;
  updateServices: (servs: Service[]) => void;
  updateBlogs: (blogs: Blog[]) => void;
  updateReviews: (revs: Review[]) => void;
  setCategories: (cats: ServiceCategory[]) => void;
  setBlogCategories: (blogCats: BlogCategory[]) => void;
  setServices: (servs: Service[]) => void;
  setBlogs: (blogs: Blog[]) => void;
  setReviews: (revs: Review[]) => void;
}

export function useCatalog(): UseCatalogReturn {
  // Initialize state synchronously from localStorage cache if available, with strict validation
  const [categories, setCategoriesState] = useState<ServiceCategory[]>(() => {
    const raw = getCachedCatalog<ServiceCategory[]>(CATALOG_CACHE_KEYS.CATEGORIES, []);
    return validateAndNormalizeCategories(raw);
  });

  const [blogCategories, setBlogCategoriesState] = useState<BlogCategory[]>(() => {
    const raw = getCachedCatalog<BlogCategory[]>(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, []);
    return validateAndNormalizeBlogCategories(raw);
  });

  const [services, setServicesState] = useState<Service[]>(() => {
    const rawCats = getCachedCatalog<ServiceCategory[]>(CATALOG_CACHE_KEYS.CATEGORIES, []);
    const validCats = validateAndNormalizeCategories(rawCats);
    const rawServs = getCachedCatalog<Service[]>(CATALOG_CACHE_KEYS.SERVICES, []);
    return validateAndNormalizeServices(rawServs, validCats);
  });

  const [blogs, setBlogsState] = useState<Blog[]>(() => {
    const rawBlogCats = getCachedCatalog<BlogCategory[]>(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, []);
    const validBlogCats = validateAndNormalizeBlogCategories(rawBlogCats);
    const rawBlogs = getCachedCatalog<Blog[]>(CATALOG_CACHE_KEYS.BLOGS, []);
    return validateAndNormalizeBlogs(rawBlogs, validBlogCats);
  });

  const [reviews, setReviewsState] = useState<Review[]>(() => {
    const rawRevs = getCachedCatalog<Review[]>(CATALOG_CACHE_KEYS.REVIEWS, []);
    return validateAndNormalizeReviews(rawRevs);
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [isUsingCache, setIsUsingCache] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetchAll = useCallback(async (): Promise<AllCatalogs> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllCatalogsWithCache();
      
      const validatedCategories = validateAndNormalizeCategories(result.catalogs.categories);
      const validatedBlogCategories = validateAndNormalizeBlogCategories(result.catalogs.blogCategories || []);
      const validatedServices = validateAndNormalizeServices(result.catalogs.services, validatedCategories);
      const validatedBlogs = validateAndNormalizeBlogs(result.catalogs.blogs, validatedBlogCategories);
      const validatedReviews = validateAndNormalizeReviews(result.catalogs.reviews);

      setCategoriesState(validatedCategories);
      setBlogCategoriesState(validatedBlogCategories);
      setServicesState(validatedServices);
      setBlogsState(validatedBlogs);
      setReviewsState(validatedReviews);
      setIsUsingCache(result.isCached);

      // Persist strictly validated state back into local cache
      setCachedCatalog(CATALOG_CACHE_KEYS.CATEGORIES, validatedCategories);
      setCachedCatalog(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, validatedBlogCategories);
      setCachedCatalog(CATALOG_CACHE_KEYS.SERVICES, validatedServices);
      setCachedCatalog(CATALOG_CACHE_KEYS.BLOGS, validatedBlogs);
      setCachedCatalog(CATALOG_CACHE_KEYS.REVIEWS, validatedReviews);

      if (result.errors.length > 0) {
        setError(result.errors.join('; '));
      }
      return {
        categories: validatedCategories,
        blogCategories: validatedBlogCategories,
        services: validatedServices,
        blogs: validatedBlogs,
        reviews: validatedReviews
      };
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch catalog');
      setIsUsingCache(true);
      return {
        categories: getCachedCatalog<ServiceCategory[]>(CATALOG_CACHE_KEYS.CATEGORIES, []),
        blogCategories: getCachedCatalog<BlogCategory[]>(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, []),
        services: getCachedCatalog<Service[]>(CATALOG_CACHE_KEYS.SERVICES, []),
        blogs: getCachedCatalog<Blog[]>(CATALOG_CACHE_KEYS.BLOGS, []),
        reviews: getCachedCatalog<Review[]>(CATALOG_CACHE_KEYS.REVIEWS, [])
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCategories = useCallback((cats: ServiceCategory[]) => {
    const validatedCats = validateAndNormalizeCategories(cats);
    setCategoriesState(validatedCats);
    setCachedCatalog(CATALOG_CACHE_KEYS.CATEGORIES, validatedCats);

    // Re-validate and protect services against category changes/deletions
    setServicesState(prevServices => {
      const revalidatedServices = validateAndNormalizeServices(prevServices, validatedCats);
      setCachedCatalog(CATALOG_CACHE_KEYS.SERVICES, revalidatedServices);
      return revalidatedServices;
    });
  }, []);

  const updateBlogCategories = useCallback((blogCats: BlogCategory[]) => {
    const validatedBlogCats = validateAndNormalizeBlogCategories(blogCats);
    setBlogCategoriesState(validatedBlogCats);
    setCachedCatalog(CATALOG_CACHE_KEYS.BLOG_CATEGORIES, validatedBlogCats);

    // Re-validate and synchronize blogs with the new blog categories
    setBlogsState(prevBlogs => {
      const revalidatedBlogs = validateAndNormalizeBlogs(prevBlogs, validatedBlogCats);
      setCachedCatalog(CATALOG_CACHE_KEYS.BLOGS, revalidatedBlogs);
      return revalidatedBlogs;
    });
  }, []);

  const updateServices = useCallback((servs: Service[]) => {
    setCategoriesState(currentCats => {
      const validatedServs = validateAndNormalizeServices(servs, currentCats);
      setServicesState(validatedServs);
      setCachedCatalog(CATALOG_CACHE_KEYS.SERVICES, validatedServs);
      return currentCats;
    });
  }, []);

  const updateBlogs = useCallback((bList: Blog[]) => {
    setBlogCategoriesState(currentBlogCats => {
      const validatedBlogs = validateAndNormalizeBlogs(bList, currentBlogCats);
      setBlogsState(validatedBlogs);
      setCachedCatalog(CATALOG_CACHE_KEYS.BLOGS, validatedBlogs);
      return currentBlogCats;
    });
  }, []);

  const updateReviews = useCallback((rList: Review[]) => {
    const validatedReviews = validateAndNormalizeReviews(rList);
    setReviewsState(validatedReviews);
    setCachedCatalog(CATALOG_CACHE_KEYS.REVIEWS, validatedReviews);
  }, []);

  const refetchReviews = useCallback(async (): Promise<Review[]> => {
    invalidateReviewsCache();
    try {
      const result = await fetchReviewsWithCache([]);
      const validated = validateAndNormalizeReviews(result.data);
      setReviewsState(validated);
      setCachedCatalog(CATALOG_CACHE_KEYS.REVIEWS, validated);
      return validated;
    } catch (err) {
      console.warn('[useCatalog] Failed to refetch reviews:', err);
      return getCachedCatalog<Review[]>(CATALOG_CACHE_KEYS.REVIEWS, []);
    }
  }, []);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  return {
    categories,
    blogCategories,
    services,
    blogs,
    reviews,
    loading,
    isUsingCache,
    error,
    refetchAll,
    refetchReviews,
    updateCategories,
    updateBlogCategories,
    updateServices,
    updateBlogs,
    updateReviews,
    setCategories: updateCategories,
    setBlogCategories: updateBlogCategories,
    setServices: updateServices,
    setBlogs: updateBlogs,
    setReviews: updateReviews
  };
}


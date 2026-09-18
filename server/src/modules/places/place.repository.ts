import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { CreatePlaceInput, ListPlaceQuery } from './place.validation.js';

const placeSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  region: true,
  countryCode: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      code: true,
      displayName: true,
    },
  },
} satisfies Prisma.PlaceSelect;

export type PlaceRecord = Prisma.PlaceGetPayload<{ select: typeof placeSelect }>;

export interface PlaceListResult {
  items: PlaceRecord[];
  total: number;
}

export interface PlaceRepository {
  findById(id: string): Promise<PlaceRecord | null>;
  findActiveCategoryById(categoryId: string): Promise<{ id: string } | null>;
  create(input: CreatePlaceInput): Promise<PlaceRecord>;
  findMany(query: ListPlaceQuery): Promise<PlaceListResult>;
}

function activePlaceWhere(query: ListPlaceQuery): Prisma.PlaceWhereInput {
  return {
    deletedAt: null,
    category: { isActive: true },
    ...(query.category ? { categoryId: query.category } : {}),
    ...(query.city ? { city: query.city } : {}),
    ...(query.country ? { countryCode: query.country } : {}),
  };
}

export const placeRepository: PlaceRepository = {
  findById: (id) =>
    prisma.place.findFirst({
      where: { id, deletedAt: null, category: { isActive: true } },
      select: placeSelect,
    }),
  findActiveCategoryById: (categoryId) =>
    prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    }),
  create: (input) =>
    prisma.place.create({
      data: {
        name: input.name,
        categoryId: input.categoryId,
        address: input.address ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        countryCode: input.countryCode ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        createdById: null,
      },
      select: placeSelect,
    }),
  findMany: async (query) => {
    const where = activePlaceWhere(query);
    const [items, total] = await prisma.$transaction([
      prisma.place.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: placeSelect,
      }),
      prisma.place.count({ where }),
    ]);
    return { items, total };
  },
};

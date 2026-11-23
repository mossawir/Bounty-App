import { createApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/app/store';
import { request, type QueryValue } from '@/api/client';
import { normalizeError } from '@/api/errors';
import { sessionExpired } from '@/features/auth/authSlice';
import type {
  AppError,
  CreateOrderRequest,
  LoginRequest,
  LoginResponse,
  OrderDetail,
  OrderSummary,
  Product,
  ProductListResponse,
  ProductQuery,
  User,
} from '@/types/domain';

interface QueryArgs {
  url: string;
  method?: 'GET' | 'POST';
  query?: Record<string, QueryValue>;
  body?: unknown;
}

const baseQuery: BaseQueryFn<QueryArgs, unknown, AppError> = async (args, api) => {
  const token = (api.getState() as RootState).auth.token;
  try {
    const data = await request<unknown>(args.url, {
      method: args.method ?? 'GET',
      ...(args.query ? { query: args.query } : {}),
      ...(args.body === undefined ? {} : { body: args.body }),
      token,
    });
    return { data };
  } catch (error) {
    const appError = normalizeError(error);
    // One rule for 401: the session dies, everywhere, exactly once.
    if (appError.status === 401 && api.endpoint !== 'login') {
      api.dispatch(sessionExpired());
    }
    return { error: appError };
  }
};

export const bazaarApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Products', 'Product', 'Order', 'Me'],
  keepUnusedDataFor: 600,
  refetchOnReconnect: true,
  endpoints: (build) => ({
    getProducts: build.query<ProductListResponse, ProductQuery>({
      query: (args) => ({
        url: '/api/products',
        query: {
          search: args.search ?? '',
          category: args.category ?? 'all',
          inStock: args.inStock ?? false,
          sort: args.sort ?? 'featured',
          page: args.page ?? 1,
          pageSize: args.pageSize ?? 24,
        },
      }),
      providesTags: (result) =>
        result
          ? [
              { type: 'Products' as const, id: 'LIST' },
              ...result.items
                .slice(0, 30)
                .map((product) => ({ type: 'Product' as const, id: product.id })),
            ]
          : [{ type: 'Products' as const, id: 'LIST' }],
    }),
    getProduct: build.query<Product, string>({
      query: (id) => ({ url: `/api/products/${encodeURIComponent(id)}` }),
      providesTags: (_result, _error, id) => [{ type: 'Product', id }],
    }),
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({ url: '/api/login', method: 'POST', body: credentials }),
    }),
    getMe: build.query<User, void>({
      query: () => ({ url: '/api/me' }),
      providesTags: ['Me'],
    }),
    createOrder: build.mutation<OrderSummary, CreateOrderRequest>({
      query: (body) => ({ url: '/api/orders', method: 'POST', body }),
      invalidatesTags: (result, _error, arg) =>
        result
          ? [
              { type: 'Products', id: 'LIST' },
              ...arg.items.map((item) => ({ type: 'Product' as const, id: item.productId })),
            ]
          : [],
    }),
    getOrder: build.query<OrderDetail, string>({
      query: (id) => ({ url: `/api/orders/${encodeURIComponent(id)}` }),
      providesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useLoginMutation,
  useGetMeQuery,
  useCreateOrderMutation,
  useGetOrderQuery,
} = bazaarApi;

export const { getProducts, getProduct, getOrder, login, getMe, createOrder } = bazaarApi.endpoints;

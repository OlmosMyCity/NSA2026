/** Sobre de paginación que devuelven todos los listados del backend. */
export interface PaginationMeta {
  total: number;
  currentPage: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

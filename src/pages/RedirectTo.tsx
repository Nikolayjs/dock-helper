import { Navigate, useLocation, useParams } from 'react-router-dom';

/**
 * Перенаправление со старого адреса на новый — с сохранением параметров запроса.
 *
 * Нужно там, где раздел переехал: закладки врача и ссылки, разосланные раньше, обязаны продолжать
 * работать. Обычный `<Navigate to="…">` для этого не годится — он теряет строку запроса, а вместе с
 * ней, например, `?use=<id>` из карточки частых бланков на дашборде.
 */
export function RedirectTo({ build }: { build: (params: Record<string, string | undefined>, search: URLSearchParams) => string }) {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate to={build(params, new URLSearchParams(search))} replace />;
}

/** Собирает адрес с параметрами, не оставляя висящего «?» на пустом наборе. */
export function withSearch(path: string, search: URLSearchParams): string {
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

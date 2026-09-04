import { API_BASE_URL } from '../../../lib/apiConfig';
import { getAuthToken } from '../../../lib/tokenStore';
import { backendErrorMessage } from '../../newsFeed/backendError';
import { isDemoSession } from '../../demo/demoSession';

/**
 * Файл анализов, переданный расширением.
 *
 * Расширение кладёт файл в промежуточный слот на сервере и открывает вкладку приложения с его
 * идентификатором; здесь он забирается — **один раз**, обычной сессией врача. Пациента расширение
 * при этом не знает и не передаёт: к кому относятся анализы, решает врач здесь, на экране
 * подтверждения. Привязка к чужой карточке — ошибка, которую потом никто не заметит.
 *
 * Свой `fetch`, а не общий `request`: тот разбирает ответ как JSON, а здесь приезжают байты.
 */
export class HandoffError extends Error {}

export async function takeHandoffFile(id: string): Promise<File> {
  // В демо сервера нет вовсе, а сырой `fetch` мимо `request` ушёл бы на настоящий API — на этом
  // приложение уже обжигалось с настройками клиники и поиском по МКБ-10.
  if (isDemoSession()) throw new HandoffError('В демо-режиме перенос из расширения недоступен.');

  const token = getAuthToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/handoff/${encodeURIComponent(id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new HandoffError('Не удалось подключиться к серверу.');
  }

  /*
   * 404 здесь значит одно из трёх — файл уже забрали, срок вышел, слот чужой, — и различать их
   * нечем намеренно: разные ответы рассказывали бы спрашивающему, что именно он угадал. Для врача
   * это один и тот же случай: отправить заново.
   */
  if (response.status === 404) {
    throw new HandoffError('Файл больше не ждёт: его уже забрали или прошло больше десяти минут. Отправьте его из расширения заново.');
  }
  if (!response.ok) {
    throw new HandoffError(await backendErrorMessage(response, `Не удалось забрать файл (${response.status}).`));
  }

  const blob = await response.blob();
  return new File([blob], fileNameFrom(response) ?? 'analysis', { type: blob.type });
}

/**
 * Имя файла из заголовка.
 *
 * Оно нужно не для красоты: по расширению имени `labFileText` понимает, что перед ним PDF.
 * Не разобралось — пусть решает тип содержимого.
 */
function fileNameFrom(response: Response): string | null {
  const header = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Тот же слот — тот же запрос, сколько бы раз страницу ни собрали заново.
 *
 * Слот отдаётся **один раз**, поэтому второй запрос за тем же файлом — это не повтор, а
 * гарантированная ошибка: «файла больше нет» вместо открытого окна разбора. Ссылка внутри страницы
 * от этого не спасает — она живёт ровно столько, сколько сама страница, а пересобрать её есть чему.
 *
 * Память живёт до перезагрузки вкладки, и этого достаточно: после перезагрузки слота всё равно нет.
 */
const started = new Map<string, Promise<File>>();

export function takeHandoffOnce(id: string): Promise<File> {
  const already = started.get(id);
  if (already) return already;

  const promise = takeHandoffFile(id);
  started.set(id, promise);
  return promise;
}

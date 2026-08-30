import { describe, expect, it } from 'vitest';

import { firstImageSrc, isSafeImageSrc } from './cover';

const JPEG = 'data:image/jpeg;base64,AAAA';
const PNG = 'data:image/png;base64,AAAA';

describe('isSafeImageSrc', () => {
  it('принимает растровые data: и обычные ссылки', () => {
    expect(isSafeImageSrc(JPEG)).toBe(true);
    expect(isSafeImageSrc(PNG)).toBe(true);
    expect(isSafeImageSrc('data:image/jpg;base64,AAAA')).toBe(true);
    expect(isSafeImageSrc('https://example.org/a.png')).toBe(true);
    expect(isSafeImageSrc('http://example.org/a.png')).toBe(true);
  });

  it('отвергает всё, что картинкой не является', () => {
    // Обложка рисуется обычным <img src>, мимо SafeHtml: проверка здесь — единственная.
    expect(isSafeImageSrc('javascript:alert(1)')).toBe(false);
    expect(isSafeImageSrc('data:text/html;base64,AAAA')).toBe(false);
    expect(isSafeImageSrc('  javascript:alert(1)')).toBe(false);
    expect(isSafeImageSrc('/uploads/a.png')).toBe(false);
    expect(isSafeImageSrc('')).toBe(false);
    expect(isSafeImageSrc(null)).toBe(false);
  });

  it('SVG обложкой не становится — это документ со скриптами, а не картинка', () => {
    expect(isSafeImageSrc('data:image/svg+xml;base64,AAAA')).toBe(false);
  });
});

describe('firstImageSrc', () => {
  it('берёт первую картинку документа', () => {
    const html = `<p>Текст</p><img src="${JPEG}"><p>Ещё</p><img src="${PNG}">`;
    expect(firstImageSrc(html)).toBe(JPEG);
  });

  it('пропускает картинку с негодным адресом и берёт следующую', () => {
    const html = `<img src="javascript:alert(1)"><img src="${PNG}">`;
    expect(firstImageSrc(html)).toBe(PNG);
  });

  it('текст без картинок обложки не даёт', () => {
    expect(firstImageSrc('<p>Только текст</p>')).toBeNull();
    expect(firstImageSrc('')).toBeNull();
  });

  it('находит картинку внутри таблицы и подписи', () => {
    expect(firstImageSrc(`<table><tr><td><img src="${JPEG}"></td></tr></table>`)).toBe(JPEG);
  });

  it('картинка без адреса не считается', () => {
    expect(firstImageSrc(`<img alt="без адреса"><img src="${JPEG}">`)).toBe(JPEG);
  });
});

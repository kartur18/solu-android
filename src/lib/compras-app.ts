// Si la app puede ofrecer la recarga de SoluCoins dentro de sí misma.
//
// EN iOS NO, Y NO ES UNA PREFERENCIA. Apple rechazó la v2.3.1 el 6-sep-2026
// (Guideline 2.1(b), envío d51cf4de): la pantalla de comprar coins mostraba los
// paquetes con precio y abría el navegador hacia solu.pe/planes para pagar con
// Culqi. Su regla 3.1.1 prohíbe exactamente eso — cualquier botón o enlace que
// lleve a un medio de pago que no sea el suyo— y su 3.1.1 sobre moneda virtual
// exige que se venda con In-App Purchase, donde Apple se queda 15-30%.
//
// Con el lead a S/2,60 ese porcentaje se come el margen, así que la decisión de
// Carlo (9-sep-2026) fue quitar la compra SOLO en iOS: el técnico de iPhone
// sigue viendo su saldo y gastándolo igual, y recarga entrando a solu.pe por su
// cuenta. En Android no cambia nada.
//
// REGLA AL TOCAR ESTO: en iOS no debe quedar ningún precio de paquete, ningún
// botón de "comprar" ni ningún enlace a /planes. Ver el saldo sí está permitido
// —es el estado de la cuenta, no una oferta—; ofrecer dónde comprarlo, no.

import { Platform } from 'react-native'

export const PUEDE_COMPRAR_EN_APP = Platform.OS !== 'ios'

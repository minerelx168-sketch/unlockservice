import QRCode from 'qrcode'

export async function paymentAddressQrDataUrl(address: string): Promise<string> {
  return QRCode.toDataURL(address, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#071a2b',
      light: '#ffffff',
    },
  })
}

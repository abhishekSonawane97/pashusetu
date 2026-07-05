// Schema.org Product JSON-LD for listing detail (NFR-09). This is the SINGLE
// documented `dangerouslySetInnerHTML` exemption (doc 12 §8.3): the payload is
// built ONLY from server-validated typed fields and serialized with a `<`
// escape so user text can never close the <script> tag. No user HTML is ever
// injected — description is a plain string value inside JSON.

type JsonLdInput = {
  id: string
  title: string
  description: string | null
  priceInr: number
  imageUrl: string | null
  status: string
  baseUrl: string
}

export function ListingJsonLd(props: JsonLdInput) {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: props.title,
    ...(props.description ? { description: props.description } : {}),
    ...(props.imageUrl ? { image: props.imageUrl } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: props.priceInr,
      availability:
        props.status === 'APPROVED' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url: `${props.baseUrl}/listings/${props.id}`,
    },
  }
  const safe = JSON.stringify(json).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- doc 12 §8.3 sole exemption: server-validated fields, `<` escaped
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}

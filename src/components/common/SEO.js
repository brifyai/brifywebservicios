import React, { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'

const SEO = ({ 
  title, 
  description, 
  keywords, 
  canonicalUrl, 
  ogImage, 
  ogType = 'website',
  noIndex = false,
  structuredData = null,
  additionalMeta = []
}) => {
  // URL base del sitio
  const baseUrl = 'https://brifyai.com'
  const fullUrl = canonicalUrl || `${baseUrl}${window.location.pathname}`
  
  // Meta tags por defecto
  const defaultTitle = 'Brify AI - Tu Asistente Inteligente de Documentos'
  const defaultDescription = 'Gestiona tus documentos con inteligencia artificial. Organiza, busca y conversa con tus archivos usando IA avanzada.'
  const defaultKeywords = 'brify ai, inteligencia artificial, gestión documental, chat con documentos, organización de archivos, IA para documentos'
  
  // Valores finales
  const finalTitle = title || defaultTitle
  const finalDescription = description || defaultDescription
  const finalKeywords = keywords || defaultKeywords
  const finalOgImage = ogImage || `${baseUrl}/images/brify-og-image.jpg`

  useEffect(() => {
    // Actualizar el título del documento
    document.title = finalTitle
  }, [finalTitle])

  return (
    <Helmet>
      {/* Meta tags básicos */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />
      
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {!noIndex && <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />}
      
      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Brify AI" />
      <meta property="og:locale" content="es_ES" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={finalOgImage} />
      <meta name="twitter:site" content="@brifyai" />
      <meta name="twitter:creator" content="@brifyai" />
      
      {/* Meta tags adicionales */}
      {additionalMeta.map((meta, index) => (
        <meta key={index} {...meta} />
      ))}
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
      
      {/* Meta tags adicionales para SEO */}
      <meta name="author" content="Brify AI" />
      <meta name="language" content="Spanish" />
      <meta name="geo.region" content="CL" />
      <meta name="geo.placename" content="Chile" />
      <meta name="ICBM" content="-33.4474870;-70.6736760" />
      
      {/* Favicon y app icons */}
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      
      {/* Preconnect para optimización */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      
      {/* DNS prefetch para recursos externos */}
      <link rel="dns-prefetch" href="//www.googletagmanager.com" />
      <link rel="dns-prefetch" href="//www.google-analytics.com" />
    </Helmet>
  )
}

export default SEO
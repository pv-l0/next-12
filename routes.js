import { nextRoutes } from '@layer0/next'
import { Router } from '@layer0/core/router'
import getPathsToPrerender from 'prerenderRequests'

const ASSET_CACHE_HANDLER = ({ removeUpstreamResponseHeader, cache }) => {
  // Remove the cache-control header coming in from the Next.js app,
  // and remove the set-cookie header coming in from the Next.js app,
  // this is to ensure that the response is cacheable
  removeUpstreamResponseHeader('set-cookie')
  removeUpstreamResponseHeader('cache-control')
  // Set the caching values
  cache({
    edge: {
      // Save the response(s) [whether stale or updated] in the edge POP for a year
      maxAgeSeconds: 60 * 60 * 24 * 365,
    },
    browser: {
      // Don't save the response in the browser
      maxAgeSeconds: 0,
      // Save the response in the browser via Layer0 service worker
      serviceWorkerSeconds: 60 * 60 * 24,
    },
  })
}

const NEXT_CACHE_HANDLER = ({ removeUpstreamResponseHeader, cache }) => {
  // Remove the cache-control header coming in from the Next.js app,
  // this is to ensure that the response is cacheable
  removeUpstreamResponseHeader('cache-control')
  // Set the caching values
  cache({
    browser: {
      // Don't save the response in the browser
      maxAgeSeconds: 0,
      // Save the response in the browser via Layer0 service worker
      serviceWorkerSeconds: 60 * 60 * 24,
    },
    edge: {
      // Save the response(s) [whether stale or updated] in the edge POP for a year
      maxAgeSeconds: 60 * 60 * 24 * 365,
      // Keep revalidating data per day, i.e. looking for content changes from the Next.js app
      // and update the response in edge
      // More on: https://web.dev/stale-while-revalidate
      // and https://docs.layer0.co/guides/caching#achieving-100-cache-hit-rates
      staleWhileRevalidateSeconds: 60 * 60 * 24,
    },
  })
}

const API_CACHE_HANDLER = ({ cache, proxy }) => {
  cache({
    edge: {
      maxAgeSeconds: 60 * 60,
      // Cache responses even if they contain cache-control: private header
      // https://docs.layer0.co/guides/caching#private
      // https://docs.layer0.co/docs/api/core/interfaces/_router_cacheoptions_.edgecacheoptions.html#forceprivatecaching
      forcePrivateCaching: true,
    },
    browser: false,
  })
  proxy('api', { path: ':path*' })
}

module.exports = new Router()
  // Pre-render the static home page
  // By pre-rendering, once the project is deployed
  // the set of links are visited to warm the cache
  // for future visits (expected to be the first view for real users)
  // More on static prerendering: https://docs.layer0.co/guides/static_prerendering
  .prerender(getPathsToPrerender)
  // Serve the compiled service worker with Layer0 prefetcher working
  .match('/service-worker.js', ({ serviceWorker }) => {
    return serviceWorker('.next/static/service-worker.js')
  })
  // The data in Next.js comes through _next/data/project-build-id route.
  // For the route /product/product-slug, cache this SSR route's data
  // it on the edge so that can be prefetched
  .match('/_next/data/:build/index.json', NEXT_CACHE_HANDLER)
  .match('/_next/data/:build/search.json', NEXT_CACHE_HANDLER)
  .match('/_next/data/:build/product/:id.json', NEXT_CACHE_HANDLER)
  // Asset caching
  .match('/_next/image/:path*', ASSET_CACHE_HANDLER)
  // API (Any backend) caching
  .match('/l0-api/:path*', API_CACHE_HANDLER)
  // Use the default set of Next.js routes
  .use(nextRoutes)

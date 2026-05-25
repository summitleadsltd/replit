// vite.config.ts
import { defineConfig } from "file:///C:/Users/cyber%20sev3n/Downloads/Remix%20of%20Summit%20Voice%20CRM/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/cyber%20sev3n/Downloads/Remix%20of%20Summit%20Voice%20CRM/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/cyber%20sev3n/Downloads/Remix%20of%20Summit%20Voice%20CRM/node_modules/lovable-tagger/dist/index.js";
import { VitePWA } from "file:///C:/Users/cyber%20sev3n/Downloads/Remix%20of%20Summit%20Voice%20CRM/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\cyber sev3n\\Downloads\\Remix of Summit Voice CRM";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  build: {
    // Don't auto-preload every async chunk transitively. Without this, Vite
    // emits <link rel="modulepreload"> tags for chunks that the visited route
    // doesn't actually need (e.g. recharts on the /auth page), causing
    // Lighthouse "unused JavaScript" warnings.
    modulePreload: { polyfill: true, resolveDependencies: () => [] },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-select", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-charts": ["recharts"]
        }
      }
    }
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.svg", "favicon-96x96.png", "apple-touch-icon.png", "robots.txt", "placeholder.svg"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-rest-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60
                // 1 minute for REST data
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/(auth\/v1|realtime\/v1|storage\/v1)\/.*/i,
            handler: "NetworkOnly",
            options: {
              cacheName: "supabase-sensitive-no-cache"
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30
                // 30 days
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"]
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxjeWJlciBzZXYzblxcXFxEb3dubG9hZHNcXFxcUmVtaXggb2YgU3VtbWl0IFZvaWNlIENSTVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcY3liZXIgc2V2M25cXFxcRG93bmxvYWRzXFxcXFJlbWl4IG9mIFN1bW1pdCBWb2ljZSBDUk1cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2N5YmVyJTIwc2V2M24vRG93bmxvYWRzL1JlbWl4JTIwb2YlMjBTdW1taXQlMjBWb2ljZSUyMENSTS92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gXCJsb3ZhYmxlLXRhZ2dlclwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiOjpcIixcbiAgICBwb3J0OiA4MDgwLFxuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogZmFsc2UsXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBEb24ndCBhdXRvLXByZWxvYWQgZXZlcnkgYXN5bmMgY2h1bmsgdHJhbnNpdGl2ZWx5LiBXaXRob3V0IHRoaXMsIFZpdGVcbiAgICAvLyBlbWl0cyA8bGluayByZWw9XCJtb2R1bGVwcmVsb2FkXCI+IHRhZ3MgZm9yIGNodW5rcyB0aGF0IHRoZSB2aXNpdGVkIHJvdXRlXG4gICAgLy8gZG9lc24ndCBhY3R1YWxseSBuZWVkIChlLmcuIHJlY2hhcnRzIG9uIHRoZSAvYXV0aCBwYWdlKSwgY2F1c2luZ1xuICAgIC8vIExpZ2h0aG91c2UgXCJ1bnVzZWQgSmF2YVNjcmlwdFwiIHdhcm5pbmdzLlxuICAgIG1vZHVsZVByZWxvYWQ6IHsgcG9seWZpbGw6IHRydWUsIHJlc29sdmVEZXBlbmRlbmNpZXM6ICgpID0+IFtdIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC9qc3gtcnVudGltZScsICdyZWFjdC9qc3gtZGV2LXJ1bnRpbWUnLCAncmVhY3Qtcm91dGVyLWRvbSddLFxuICAgICAgICAgICd2ZW5kb3Itc3VwYWJhc2UnOiBbJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcyddLFxuICAgICAgICAgICd2ZW5kb3ItdWknOiBbJ0ByYWRpeC11aS9yZWFjdC1kaWFsb2cnLCAnQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXInLCAnQHJhZGl4LXVpL3JlYWN0LXNlbGVjdCcsICdAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudScsICdAcmFkaXgtdWkvcmVhY3QtdGFicycsICdAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcCddLFxuICAgICAgICAgICd2ZW5kb3ItcXVlcnknOiBbJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddLFxuICAgICAgICAgICd2ZW5kb3ItY2hhcnRzJzogWydyZWNoYXJ0cyddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCksXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAnZmF2aWNvbi5zdmcnLCAnZmF2aWNvbi05Nng5Ni5wbmcnLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAncm9ib3RzLnR4dCcsICdwbGFjZWhvbGRlci5zdmcnXSxcbiAgICAgIG1hbmlmZXN0OiBmYWxzZSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdlYnB9J10sXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC8uKlxcLnN1cGFiYXNlXFwuY29cXC9yZXN0XFwvdjFcXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3N1cGFiYXNlLXJlc3QtY2FjaGUnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwIC8vIDEgbWludXRlIGZvciBSRVNUIGRhdGFcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC8uKlxcLnN1cGFiYXNlXFwuY29cXC8oYXV0aFxcL3YxfHJlYWx0aW1lXFwvdjF8c3RvcmFnZVxcL3YxKVxcLy4qL2ksXG4gICAgICAgICAgICBoYW5kbGVyOiAnTmV0d29ya09ubHknLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdzdXBhYmFzZS1zZW5zaXRpdmUtbm8tY2FjaGUnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwuKD86cG5nfGpwZ3xqcGVnfHN2Z3xnaWZ8d2VicCkkL2ksXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2ltYWdlLWNhY2hlJyxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDYwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDMwIC8vIDMwIGRheXNcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0pXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gICAgZGVkdXBlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0L2pzeC1ydW50aW1lXCIsIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCJdLFxuICB9LFxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4VyxTQUFTLG9CQUFvQjtBQUMzWSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUp4QixJQUFNLG1DQUFtQztBQU96QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLTCxlQUFlLEVBQUUsVUFBVSxNQUFNLHFCQUFxQixNQUFNLENBQUMsRUFBRTtBQUFBLElBQy9ELGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxxQkFBcUIseUJBQXlCLGtCQUFrQjtBQUFBLFVBQ3ZHLG1CQUFtQixDQUFDLHVCQUF1QjtBQUFBLFVBQzNDLGFBQWEsQ0FBQywwQkFBMEIsMkJBQTJCLDBCQUEwQixpQ0FBaUMsd0JBQXdCLHlCQUF5QjtBQUFBLFVBQy9LLGdCQUFnQixDQUFDLHVCQUF1QjtBQUFBLFVBQ3hDLGlCQUFpQixDQUFDLFVBQVU7QUFBQSxRQUM5QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sU0FBUyxpQkFBaUIsZ0JBQWdCO0FBQUEsSUFDMUMsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLGVBQWUsZUFBZSxxQkFBcUIsd0JBQXdCLGNBQWMsaUJBQWlCO0FBQUEsTUFDMUgsVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBLFFBQ1AsY0FBYyxDQUFDLHFDQUFxQztBQUFBLFFBQ3BELGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxjQUNYLFlBQVk7QUFBQSxnQkFDVixZQUFZO0FBQUEsZ0JBQ1osZUFBZTtBQUFBO0FBQUEsY0FDakI7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFVBQ0E7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxZQUNiO0FBQUEsVUFDRjtBQUFBLFVBQ0E7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxjQUNYLFlBQVk7QUFBQSxnQkFDVixZQUFZO0FBQUEsZ0JBQ1osZUFBZSxLQUFLLEtBQUssS0FBSztBQUFBO0FBQUEsY0FDaEM7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSCxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQ2hCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLElBQ0EsUUFBUSxDQUFDLFNBQVMsYUFBYSxxQkFBcUIsdUJBQXVCO0FBQUEsRUFDN0U7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=

#!/usr/bin/env bash
# ============================================================================
# Batch upload script for tboxrouter static assets
# ============================================================================
# Usage:
#   1. Open https://tboxrouter.antglobal-inc.com/adminpro/content/static_assets
#      in Chrome, open DevTools → Network tab
#   2. Upload ONE image manually to capture the request
#   3. Right-click the "upload" request → Copy → Copy as cURL
#   4. Run this script:
#        bash scripts/batch-upload-tbox.sh
#
# The script will upload all images from results/vibe-writing/assets/
# and paper/figures_en/*.png using the same auth tokens from the cURL above.
# ============================================================================

set -euo pipefail

# --- CONFIGURATION: Fill these from your browser's Network tab ---
# Copy the full cookie string from any API request to tboxrouter
COOKIES='receive-cookie-deprecation=1; _ga=GA1.1.1500496447.1758200233; _gcl_au=1.1.1411081921.1778041627; sessionId=743bc851-14c1-456f-b826-2175013ed459; sessionId.sig=oMsive8MuHOxtwZtxPFvf1cJIw5ubM4vx1uaQR_FcN8; locale=en-US; __stripe_mid=9a587196-80e0-4d3b-8213-f67f7d8a946a6a08e8; IAM_TOKEN=eyJraWQiOiJkZWZhdWx0IiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJjbmwiOiJCVUMiLCJzdWIiOiJ5ZXpoZW5qaWUueXpqIiwiYXV0aF90cCI6WyJET01BSU4iXSwiaXNzIjpbImF0cyJdLCJub25jZSI6ImYwOTE2NDMiLCJzaWQiOiI4NDg2ODQ1IiwiYXVkIjoiKiIsIm5iZiI6MTc4MDg4Nzg4NCwic25vIjoiNDg3MzgxIiwibmFtZSI6IuabpuW-gSIsImV4cCI6MTc4MDk3NDM0NCwiaWF0IjoxNzgwODg3OTQ0LCJqdGkiOiI3ODU4ZDA0ODZjMDU0YjRlOGY4MGJiMDgwNjM5ZThhZiJ9.GeI7nq8yFjKPq6RfNWVCLjzsr7wMtRuvS3BW9IY1WAwd7ivPAuftdA3314TnfIYce1GLUuyQ6FpJp-EFGsb1ow; ph_phc_Bury9eCEN52fBHZcCPmWqoeJv3PMb4ygHELVpAVqWkqH_posthog=%7B%22%24device_id%22%3A%22019ea516-2bd4-7a43-8c8a-93ad862385f4%22%2C%22distinct_id%22%3A%222533AC0Q5MIe14613672%22%2C%22%24sesid%22%3A%5B1780890320635%2C%22019ea555-beff-7fa4-9a31-4a40027d459b%22%2C1780890320635%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22https%3A%2F%2Ftboxrouter-pre.antglobal-inc.com%2Fadminpro%2Fprice%2Fapprove%22%2C%22u%22%3A%22https%3A%2F%2Ftboxrouter-pre.antglobal-inc.com%2F%22%7D%2C%22%24user_state%22%3A%22identified%22%7D; _ga_PV8J0P36S8=GS2.1.s1780890321$o459$g0$t1780890321$j60$l0$h0; ctoken=BfNQVqP8-oSh3_UjEo0YV78A; zt-id-stsq=1780967692.vRzXUra1.13250905; acw_tc=0a0a01e917809672116798782e63d0a4eaa07f8e4cdb7621722bc3c77ddaf4; spanner=mUdHWdt7uiMINfHresoophq4qI6IhfXh4EJoL7C0n0A='

# The ctoken value (same as in cookies, used as query param)
CTOKEN="BfNQVqP8-oSh3_UjEo0YV78A"

# The starpoint-data2 header value (copy from any API request)
STARPOINT="1.1175a16dea464b6b948753a7f7dae241.MjRxMGZ4ZG1QNEJKNm9yVA==.1780902303.ea0c7de16c42546704ef349b2b1c2838.SXs5qoXsgA9izg9v4b410UZItzj+SXX4LDJstFBj6A2ibgOWRLcm4r8b7kaNJ+SCCoilIFpl3j85/e36PRHmMEwUdLIydhF2Kufq4BsV2UtxPtiZpuQsaXunnZwltF6GE+mfA2fRX/AcKLJPNf7cIvqAZYkee/0++igpbCO+QO3KEmnHeMabpoYIVP1ewalPSb+k2MaU+462a1k0SlGoZw=="

# The staticAssetUploadSession cookie (only appears after visiting upload page)
# This is critical — the upload will fail without it
UPLOAD_SESSION="eyJhY2NvdW50SWQiOiIyNTMzQUMwUTVNSWUxNDYxMzY3MiIsInVzZXJuYW1lIjoiYWk1MzU5MjcwMDFAZ21haWwuY29tIiwiaXNzdWVkQXQiOjE3ODA5Njc2OTM0MTN9"
UPLOAD_SESSION_SIG="81dIHoHT6rewQGq-G9Fn9X1UyBX9YlUoOwfxAj8QCwg"

# --- END CONFIGURATION ---

BASE_URL="https://tboxrouter.antglobal-inc.com"
UPLOAD_URL="${BASE_URL}/api/adminpro/static-assets/upload?ctoken=${CTOKEN}"
LIST_URL="${BASE_URL}/api/adminpro/static-assets/list?ctoken=${CTOKEN}&assetType=image&maxKeys=300"
ASSETS_DIR="results/vibe-writing/assets"
PAPER_DIR="paper/figures_en"

# Combine all cookies
ALL_COOKIES="${COOKIES}; staticAssetUploadSession=${UPLOAD_SESSION}; staticAssetUploadSession.sig=${UPLOAD_SESSION_SIG}"

echo "============================================"
echo "TBox Router Static Assets Batch Upload"
echo "============================================"
echo ""
echo "Upload URL: ${UPLOAD_URL}"
echo "Sources:  ${ASSETS_DIR}/*   ${PAPER_DIR}/*.png"
echo ""

# Collect files from both directories (PNG/JPG only from figures_en)
shopt -s nullglob
files=("${ASSETS_DIR}"/*)
# Only collect PNG files from paper/figures_en
files+=("${PAPER_DIR}"/*.png)

# Deduplicate by basename (first occurrence wins — assets dir has priority)
declare -A seen
unique_files=()
for f in "${files[@]}"; do
  bname=$(basename "$f")
  if [[ -z "${seen[$bname]:-}" ]]; then
    seen[$bname]=1
    unique_files+=("$f")
  fi
done
files=("${unique_files[@]}")
total=${#files[@]}
echo "Found ${total} files to upload (duplicates across dirs deduplicated)"
echo "============================================"
echo ""

success=0
failed=0
skipped=0
declare -a failed_files

for filepath in "${files[@]}"; do
  filename=$(basename "$filepath")

  # Determine source directory for display
  if [[ "$filepath" == *"paper/figures_en"* ]]; then
    source="paper"
  else
    source="assets"
  fi

  # Determine MIME type from extension
  ext="${filename##*.}"
  case "${ext,,}" in
    png)  mime="image/png" ;;
    jpg|jpeg) mime="image/jpeg" ;;
    gif)  mime="image/gif" ;;
    svg)  mime="image/svg+xml" ;;
    webp) mime="image/webp" ;;
    *)    mime="application/octet-stream" ;;
  esac

  echo -n "[$((success+skipped+1))/${total}] [${source}] Uploading: ${filename} (${mime}) ... "

  # Build multipart form data using curl's -F which handles boundary automatically
  response=$(curl -s -w "\n%{http_code}" \
    "${UPLOAD_URL}" \
    -X POST \
    -H "accept: application/json, text/plain, */*" \
    -H "accept-language: en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7" \
    -H "cache-control: no-cache" \
    -H "origin: ${BASE_URL}" \
    -H "pragma: no-cache" \
    -H "referer: ${BASE_URL}/adminpro/content/static_assets" \
    -H "sec-ch-ua: \"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"" \
    -H "sec-ch-ua-mobile: ?0" \
    -H "sec-ch-ua-platform: \"macOS\"" \
    -H "sec-fetch-dest: empty" \
    -H "sec-fetch-mode: cors" \
    -H "sec-fetch-site: same-origin" \
    -H "starpoint-data2: ${STARPOINT}" \
    -H "user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36" \
    -b "${ALL_COOKIES}" \
    -F "file=@${filepath};filename=${filename};type=${mime}" \
    -F "assetType=image" \
    -F "overwrite=false" \
    2>&1)

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" == "200" ]] || [[ "$http_code" == "201" ]]; then
    echo "✓ OK (HTTP ${http_code})"
    # Try to extract the CDN URL from response
    cdn_url=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('url',''))" 2>/dev/null || echo "")
    if [[ -n "$cdn_url" ]]; then
      echo "       CDN: ${cdn_url}"
    fi
    ((success++))
  elif [[ "$http_code" == "409" ]]; then
    echo "⚠ Skipped (already exists, HTTP ${http_code})"
    ((skipped++))
  else
    echo "✗ FAILED (HTTP ${http_code})"
    echo "       Response: ${body}"
    failed_files+=("$filename")
    ((failed++))
  fi

  # Small delay to avoid rate limiting
  sleep 0.3
done

echo ""
echo "============================================"
echo "Upload Summary"
echo "============================================"
echo "  Total:   ${total}"
echo "  Success: ${success}"
echo "  Skipped: ${skipped}"
echo "  Failed:  ${failed}"
echo ""

if [[ ${#failed_files[@]} -gt 0 ]]; then
  echo "Failed files:"
  for f in "${failed_files[@]}"; do
    echo "  - $f"
  done
fi

echo ""
echo "Verifying by listing all uploaded assets..."
echo ""

# List all uploaded assets
curl -s "${LIST_URL}" \
  -H "accept: application/json, text/plain, */*" \
  -H "cache-control: no-cache" \
  -H "referer: ${BASE_URL}/adminpro/content/static_assets" \
  -H "starpoint-data2: ${STARPOINT}" \
  -b "${ALL_COOKIES}" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
assets = data.get('data', data) if isinstance(data, dict) else data
if isinstance(assets, list):
    print(f'Total assets on server: {len(assets)}')
    for a in assets:
        name = a.get('fileName', a.get('key', '?'))
        url = a.get('url', '')
        print(f'  {name} → {url}')
elif isinstance(assets, dict):
    keys = assets.get('keys', assets.get('contents', []))
    print(f'Total assets on server: {len(keys)}')
    for k in keys:
        print(f'  {k}')
else:
    print(json.dumps(data, indent=2)[:2000])
" 2>/dev/null || echo "(Could not parse list response — check cookies/tokens)"

echo ""
echo "Done."

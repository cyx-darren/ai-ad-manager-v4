# Claude Memory - AI Ad Manager Project

## 🚀 Frontend Server Configuration
- **Always start frontend on port 3000**: `npm run dev` should run on http://localhost:3000
- **Dashboard URL**: http://localhost:3000 (main application)
- **If port conflict**: Kill processes on port 3000 first, then restart

## 📊 GA4 Analytics MCP Integration Status
- **MCP Server**: Running on port 3004 (GA4 Analytics MCP)
- **Health Check**: Port 3003 (GA4 MCP health endpoints)
- **API Route**: `/api/mcp` connects frontend to GA4 MCP server
- **Feature Flags**: Enabled for GA4 metric cards in Supabase
- **Credentials**: GA4 property 255973574 with service account configured

## 🔧 Current Setup Working
1. ✅ Frontend (Next.js) → Port 3000
2. ✅ MCP API Route → `/api/mcp` 
3. ✅ GA4 MCP Server → Port 3004
4. ✅ GA4 Health Server → Port 3003
5. ✅ Real GA4 data integration with fallback to mock data

## 🗃️ Database
- **Supabase Project**: ai-ad-manager-v2 (fjfwnjrmafoieiciuomm)
- **Feature Flags**: metric_cards_*_mcp flags enabled for GA4 integration
- **Fallback**: metric_cards_fallback_enabled = true

## 📱 Metric Cards Integration
- Sessions Card: Uses real GA4 data via MCP
- Users Card: Uses real GA4 data via MCP  
- Bounce Rate Card: Uses real GA4 data via MCP
- Conversions Card: Uses real GA4 data via MCP
- **Source Indicator**: "ga4-mcp" = real data, "fallback" = mock data

## 🛠️ Commands
- Start Frontend: `cd ai-google-ads-manager && npm run dev` (port 3000)
- Start GA4 MCP: `cd ga4-analytics-mcp && node dist/index.js` (port 3004)
- Kill Port 3000: `lsof -ti:3000 | xargs kill -9`

## 📁 Project Structure
```
ai-ad-manager-v4/
├── ai-google-ads-manager/          # Next.js Frontend (port 3000)
│   ├── app/api/mcp/route.ts        # MCP API proxy
│   └── components/dashboard/       # Metric cards
└── ga4-analytics-mcp/              # GA4 MCP Server (port 3004)
    ├── dist/index.js               # Built MCP server
    └── .env                        # GA4 credentials
```
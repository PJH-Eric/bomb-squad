# 炸彈小隊宣傳美術

使用內建 image_gen 生成。SEO 與 cover 分別生成，原圖保留在此目錄。

- `seo-source.png` → `public/assets/images/seo.webp`：1200×675，含正式繁中標題，供 OG／Twitter／JSON-LD 使用。
- `cover-source.png` → `public/assets/images/cover.webp`：1200×675，無文字，大廳既有 URL 可直接沿用。
- `public/og-image.png`：相同 SEO 圖的 PNG 相容檔。

以 Pillow Lanczos 等比例縮放留邊，WebP 品質 90。兩張 WebP 合計約 202 KB。

## 驗證

- SEO 注入、重複建置、三語 metadata 與分享圖分離測試通過。
- package.json 的完整 test 指令鏈通過（規則、五段 AI、教學、房間、伺服器與線上流程）。
- Chrome：三語 × 手機直／橫向、平板直／橫向、桌機，首頁、說明、角色、教學列表與單機設定共 75 組無文件水平溢出。
- 兩張 WebP 經瀏覽器 decode，實際 1200×675，HTTP 200 且 MIME 為 image/webp。
- 短時限實際規則結算、結算彈窗與再來一局通過。
- 既有 browser-check.js 的線上邀請／觀戰／自動關房通過且無 console 錯誤；仍有 11 個舊版版面斷言失敗。手機直向原有旋轉提示下畫布高 176px、HUD 徽章內高 30px，與未修改 HEAD 的量測相同。未改動其驗證條件，不宣稱該腳本全數通過。
- 依 loop-engineering 完成有界最後確認；圖片載入檢查發現缺少 WebP MIME，修正後伺服器測試與瀏覽器載入檢查均通過。無新規則或遊戲版面調整。
- 未設定 formatter，依原專案風格手動整理本次修改，git diff --check 通過。

## SEO prompt

Use case: ads-marketing. Create a premium landscape social sharing illustration for the original browser game 炸彈小隊 (Bomb Squad). Aspect ratio 16:9, image intended for 1200x675. Left 58%: a charming soft clay 3D miniature bomber arena, peach destructible brick blocks and lavender indestructible pillars on cream square tiles, two original round little helmeted adventurer characters, one teal and one coral, dodging a friendly stylized golden cross-shaped chain explosion from a charcoal spherical bomb with a lit short fuse. Clear cute silhouettes, playful action, no weapons besides cartoon spherical game bombs. Right 42%: beautifully typeset, very large, perfectly legible Traditional Chinese title exactly 「炸彈小隊」 arranged in two lines 炸彈 / 小隊, deep plum lettering with subtly dimensional cream edging. Background warm ivory with very pale lilac gradients, teal and coral accents, golden explosion, tactile matte clay, professional toy-like CGI, soft studio light, ambient occlusion, refined editorial composition. Keep all title characters and main subjects inside 10% safe margins. No extra text, no English, no branding, no watermarks, no UI or buttons. It should communicate bomb placement, brick destruction and survival rather than just showing a bomb icon.

## Cover prompt

Use case: ads-marketing. Independent landscape 16:9 cover art for original browser game 炸彈小隊, no text anywhere. Premium soft clay 3D toy illustration, warm ivory tiles, peach brick blocks, lavender stone pillars, teal and coral little original helmeted adventurers with goggles and scarves, matte tactile materials and soft studio lighting. A centered miniature bomber-game arena viewed from elevated isometric angle, with a prominent charcoal round bomb with short sparkling fuse at the central intersection, golden cross-shaped chain explosion traveling through tile corridors, a few bricks playfully breaking, teal character escaping towards front left and coral character escaping towards back right. Symmetrical visual weight but natural dynamic independent composition, clear silhouettes readable as small game-lobby thumbnail. Show bomb placement, dodging, destructible brick maze, not combat weapons. Pale ivory/lilac backdrop with generous breathing room. Keep all major characters and action inside central 80%, rounded arena base visible with soft grounded shadow, polished professional game key art. No lettering, no numbers, no title, no logos, no watermark, no UI buttons.


# Số liệu thật + đề xuất đã nêu + quy tắc anh Vinh (agent docs, 11/09) — trích nguồn CLAUDE.md / docs/lenh-*.md

## A1. Cấu hình & cơ chế
- Ngưỡng nhiệt độ: `tempOf = h≥80 hot · ≥60 warm · ≥40 cold · <40 junk`; giữ lead khi `is_real_lead && !roleBlock && hotness ≥ MIN_KEEP_SCORE(40)` (fixture index.js:6, :415).
- aiMode `saver|max` (config/app.aiMode, ghi đè theo nguồn `src.aiMode`); lượt thật `twoStage true, aiMode saver`.
- Lọc từ khoá: chế độ 2 tầng KHÔNG dùng cổng keyword include, chỉ `isExcluded(text, effSrc)`; effSrc = keyword/exclude nguồn ⊕ toàn cục (index.js:307–324).
- Song song: PREFILTER_CONCURRENCY 10 (gpt-5-nano) · SCORE_CONCURRENCY 6 (gpt-5.6-sol) · mapPool(sources,3) · seen theo lô 300.
- Probe 5 bài/nguồn · sweep 20 bài mỗi 2 h · `posts_to_not_include` = group_state.recentIds ≤200.
- TTL: SCANNED_TTL_DAYS 7→3 (bài không thành lead); lead expireAt null; `seen` vĩnh viễn; outreach_log 60 ngày.
- Tần suất: Scheduler every 3 minutes, attemptDeadline 1800 s; scanIntervalMin mặc định 10 (UI 3–180); thực tế gieo mỗi ~12′.
- Timeout: scheduledScan 1800 s, maxInstances 1, 512Mi; bdWaitSoft 90 s; comment bdWait 510 s đã bỏ (#23); LLM sau #46: 60 s + 4 lần thử (2/5/12 s).
- Nguồn: 32 / 28 bật (04/09) → tắt 5 nguồn nick (test-agency) → 23 bật / 0 nick, 4 brand (hscl-01, test-agency, z15mrc-tts-1, z15mrc-tuyendung1).

## A2. Yield quét
- 04/09 trước vá: 28 nguồn tuần tự, 231–813 s, 7/40 lượt >540 s, llmCalls 1–41, leads 0–5/lượt, scrapeErrors 5 mọi lượt.
- 04h→15h 04/09: BrightData `Customer is not active` ~12 h liên tục, 0 bài, không báo (đã có [BRIGHTDATA-DOWN] từ #21).
- Lượt dài nhất 1.577 s: backlog 372 bài / 603 bdRecords / 24 lead. Yield khi BD chết: ~30 bài mới/20 lượt/28 nguồn.
- Lượt mẫu 814 s: 4 bài → 4 ứng viên → 1 qua tầng 1 → 0 lead, 4+1 lượt AI, 10.534 token, ~$0,0149.
- Sau #21: lượt 0,4–6,4 s. 24 h 05/09: 21/23 nguồn có bài, ~1.300 record, ~60 lead. Ban ngày 05/09: 09:29 20 bài/2 lead/35 llm/79 s; 17/23 nguồn có bài trong ~6 h sáng.
- dead_page = BrightData báo "không còn bài ngoài danh sách đã thấy" (test A/B #22b) → gần như không tốn tiền.
- 11/09 17:14–17:26 (sau #46): 4 lượt 3–8 bài/lượt, scoreCalls 0–3 bài mới/lượt (+12 sweeper), 0 lead trong 4 lượt.

## A3. Bộ đếm 14/60 ngày (#41/#42)
- 14 ngày mọi brand: bài quét 25.246 · lead hợp lệ 939 · nóng 250 · chốt 1. Brand: hscl-01 291/72 · test-agency 39/3 · tts 434/164 · tuyendung 175/11.
- 60 ngày: 2.005 lead, bỏ 158 lead vai; hscl-01 570/137 · test-agency 223/76 · tts 615/226 · tuyendung 275/34.
- `daily_stats.junk` luôn 0 vì scanner không ghi lead junk vào `leads` (junk chỉ ở scanned_posts).
- SLA #40: lead được "chăm lần đầu" chỉ 4–6 lead/60 ngày/brand (hscl 4, đạt 1 = 25 %; tts 6/5).

## A4. Comment-lead & vai (#31)
- 359 comment-lead/30 ngày → 158 (44 %) là CHÍNH CHỦ BÀI (hot 16), 7 đã bị máy chạm; +47 bình luận "mùi người bán", có ca hot 80–90.
- Sau deploy: scanned_posts 3 h: 27 {scored_low 4, prefiltered_out 14, excluded 3, lead 1, seller 5}; ban ngày: self_comment 1, seller 5, lead mới 2 buyer.

## A5. Điểm tạm (#45/#46)
- Gốc OpenAI 500 từng đợt; heuristic "Thuê mb chỉ 5 triệu" = 90 nóng; 14 ngày 7 lead điểm tạm nhưng TOÀN KHO 252 (đa số 26/08).
- #46 KHỐI 2: llmOk 12–15/llmFail 0; sweeper chấm lại 48 lead/4 lượt → LOẠI 44 (đa số rescore_role người bán/chủ bài), điểm giảm 47/48; gọi thử bài #399 → hotness 10.
- genContent 16 s/lead gpt-5.6-sol; LLM_MAX_TOKENS 700→2000.
- Ngân sách BrightData: chỉ có widget bd_month + bdBudget/bdFx/openaiCredit (config/private) — không thấy con số thật trong tài liệu.

## B. Đề xuất đã nêu trước (trạng thái)
- P23 self-service brand + lịch quét thích ứng: ANH ĐÃ BỎ phần self-service (Q6); phần "lịch quét thích ứng" chưa được chốt riêng.
- P37 AI học theo brand (👍/👎 few-shot): FE calibCard đã làm (chỉ hiển thị); backend chưa.
- P38 chi phí/lead theo brand & nguồn: 1 phần (attributionCard); CPL/nguồn + tạm dừng nguồn kém chưa làm.
- P43 che SĐT/pii_log: chưa; xung đột Q1 (bỏ pháp lý) → chỉ làm nếu anh coi là bảo mật.
- P52 taxonomy ngành/dịch vụ enum: 1 phần (INDUSTRY_LIB FE); ép enum prompt + backfill chưa.
- P29 thư viện keyword/nguồn theo ngành: 1 phần; brand_templates/Nhân bản chưa.
- P10/P16 (Hôm nay, tìm SĐT): ĐÃ LÀM. "Quét thử riêng nguồn": ĐÃ LÀM v119-57.
- P51 next-best-lead cho engine ≈ R-4 automation: chưa (Đợt 2).
- P19 hồ sơ khách theo SĐT/author_url + cờ nghi người bán: 1 phần (phoneHistoryHtml).
- P06 Content Studio: đã làm; spam-score chưa gate (E-10). P21 holdout/attribution chưa.
- Bulk nick 3000: ANH ĐÃ BỎ. Nick quét cookie (fetchPostsAuth): ĐANG TẮT; config.js chưa map BROWSER_SVC_URL/SECRET.
- ĐÃ BỎ HOÀN TOÀN: pháp lý/tuân thủ (Q1), ZBS bản tin sáng, Zalo cá nhân (P09), billing/gói giá (P13/P22/P23), đa brand 1 tài khoản (P12).
- Còn tồn #31: KHỐI 3 rescore tuỳ chọn chưa chạy. Còn tồn #46: LỆNH #47 index leads(ai_scored, detected_at) chờ điều kiện.
- Automation Đợt 2/3 chờ anh gọi: R-3 bắt phản hồi qua Thông báo, R-4 hàng đợi ưu tiên nóng, R-7 giám sát push, R-10 quality gate nội dung, R-11 follow-up lần 2, R-12 màn Hàng đợi & kẹt, R-13 dò FB đổi giao diện, R-14 hành vi giống người.

## C. Quy tắc / gu anh đã chốt
1 Không nhận người bán/đối thủ/chính chủ bài làm lead; cổng vai ở CẢ scanner lẫn engine. 2 Bình luận công khai luôn có CTA (direct mặc định). 3 Q3 được thay lead.reply bằng nội dung AI. 4 Q6 KHÔNG self-service/billing — Super Admin set hộ. 5 Q1 BỎ pháp lý/tuân thủ. 6 Q7 Super full quyền; Q5 Zalo chỉ OA Z15; bỏ bản tin sáng. 7 Backend chỉ qua LỆNH bash anh dán Cloud Shell; script Admin SDK trong functions/; patch fail-closed idempotent backup; deploy xích &&. 8 VPS của anh, không đụng SA key/kiến trúc worker. 9 Fail-closed, verify kết quả thật, checkpoint = dừng. 10 Nick worker để FB Tiếng Việt. 11 "Lead hợp lệ" = AI ≥40, không junk, không dropped. 12 Bộ đếm không tính vai người bán/chủ bài; sales bấm Loại vẫn tính hợp lệ. 13 Bỏ bulk-import nick. 14 Không có quy tắc riêng về ngưỡng temp — ngưỡng nằm trong code 80/60/40 + config/app.weights.

## D. Field có sẵn
- leads: post_url(100 %) · post_id(rỗng) · author_url(~31 %) · comment_id/url · kind · brand · stage/stage_at · temp · score · name("Ẩn danh" nhiều) · intent · need · service · industry · phone · email · source · detected_at · time · reply · role/role_reason/self_comment · parent_author/text/url · ai_scored/rescored_at/ai_prev · dropped/dropped_at/dropped_by · lost/lost_reason · closed_at · deal_value · assignee · first_care_at · last_touch_at · fu_at · outreach{…} · outreach_replied · identityKey · touches · group_count · base_score · phone_has_zalo · profile_status/snapshot/url.
- scanned_posts: jobId · trigger · source · sourceUrl · brand · author · text(≤600) · post_url · time · kind · parent_* · comment_id/url · decision ∈ {lead, scored_low, prefiltered_out, excluded, no_keyword, error, self_comment, seller, ai_wait} · score · temp · intent · service · kept · role · createdAt · expireAt.
- scans: trigger · twoStage · aiMode · durationMs · sourcesCount · postsFetched · commentsFetched · candidates · postsMatched · leadsCreated · hotLeads · skippedSeen · backfillSkipped · commentsRefreshSkipped · scoreErrors · scrapeErrors · llmCalls · prefilterCalls · scoreCalls · probeRuns · sweepRuns · probeEscalated · probeIdle · bdRecords · bdCommentRecords · authRuns · authCheckpoints · tokens* · costUsd · conversion · dist · bySource[{name,industry,url,posts,matched,leads,hot,error,bdPosts,bdComments,ekyc}] · #46: llmDeferred/llmFallback/llmRescored/llmRescoredLeads/llmOk/llmFail/llmErr/llmPreFail.
- Phụ trợ: pending_snapshots(P_*/C_*), group_state{recentIds,lastTriggerAt,lastSweepAt}, seen/{post_id}, cmt_scrape, score_retry/{R_*}, system_status/{brightdata,llm,outreach}, daily_stats, bd_month.

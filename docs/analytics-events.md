# Fernly Analytics Event Catalog

Generated from `analytics/manifest.ts`. RevenueCat is the only source of subscription lifecycle revenue; these client events contain funnel status only.

| Event | Description | Trigger | Allowed parameters | AppsFlyer name | Priority | Partner postback |
|---|---|---|---|---|---|---|
| `account_delete_prompt` | Records the Fernly account delete prompt product milestone. | Emitted by the existing account delete prompt application flow. | source:string | same name | none | no |
| `account_delete_result` | Records the Fernly account delete result product milestone. | Emitted by the existing account delete result application flow. | reason:string; result:string | same name | none | no |
| `alternate_selected` | Records the Fernly alternate selected product milestone. | Emitted by the existing alternate selected application flow. | alternate_rank:number; selected:boolean | same name | none | no |
| `camera_permission_result` | Records the Fernly camera permission result product milestone. | Emitted by the existing camera permission result application flow. | result:string; source:string | same name | none | no |
| `care_log_result` | Records the Fernly care log result product milestone. | Emitted by the existing care log result application flow. | reason:string; result:string; type:string | same name | none | no |
| `care_reminder_toggle` | Records the Fernly care reminder toggle product milestone. | Emitted by the existing care reminder toggle application flow. | enabled:boolean; result:string; source:string | same name | none | no |
| `diagnose_result` | Records the Fernly diagnose result product milestone. | Emitted by the existing diagnose result application flow. | reason:string; result:string; stage:string | same name | none | no |
| `diagnosis_attach_select` | Records the Fernly diagnosis attach select product milestone. | Emitted by the existing diagnosis attach select application flow. | source:string | same name | none | no |
| `diagnosis_expand` | Records the Fernly diagnosis expand product milestone. | Emitted by the existing diagnosis expand application flow. | expanded:boolean | same name | none | no |
| `diagnosis_save_result` | Records the Fernly diagnosis save result product milestone. | Emitted by the existing diagnosis save result application flow. | attached_to_plant:boolean; reason:string; result:string; target:string | same name | none | no |
| `deep_link_open` | Records the Fernly deep link open product milestone. | Emitted by the existing deep link open application flow. | deferred:boolean; destination:string; result:string | same name | none | no |
| `first_plant_saved` | Records the Fernly first plant saved product milestone. | Emitted by the existing first plant saved application flow. | source:string | same name | high | yes |
| `free_limit_hit` | Records the Fernly free limit hit product milestone. | Emitted by the existing free limit hit application flow. | mode:string; reason:string; stage:string | same name | none | no |
| `frost_alert_toggle` | Records the Fernly frost alert toggle product milestone. | Emitted by the existing frost alert toggle application flow. | enabled:boolean; result:string | same name | none | no |
| `growth_photo_add` | Records the Fernly growth photo add product milestone. | Emitted by the existing growth photo add application flow. | reason:string; result:string; source:string | same name | none | no |
| `identify_result` | Records the Fernly identify result product milestone. | Emitted by the existing identify result application flow. | has_species_profile:boolean; reason:string; result:string | `af_search` | high | yes |
| `legal_link_tap` | Records the Fernly legal link tap product milestone. | Emitted by the existing legal link tap application flow. | surface:string; target:string | same name | none | no |
| `library_permission_result` | Records the Fernly library permission result product milestone. | Emitted by the existing library permission result application flow. | result:string; source:string | same name | none | no |
| `manage_subscription_link` | Records the Fernly manage subscription link product milestone. | Emitted by the existing manage subscription link application flow. | source:string | same name | none | no |
| `offer_code_redemption` | Records the Fernly offer code redemption product milestone. | Emitted by the existing offer code redemption application flow. | result:string; source:string | same name | none | no |
| `onboarding_complete` | Records the Fernly onboarding complete product milestone. | Emitted by the existing onboarding complete application flow. | method:string | `af_tutorial_completion` | high | yes |
| `onboarding_skip` | Records the Fernly onboarding skip product milestone. | Emitted by the existing onboarding skip application flow. | none | same name | none | no |
| `notification_open` | Records the Fernly notification open product milestone. | Emitted by the existing notification open application flow. | destination:string; source:string | `af_opened_from_push_notification` | none | no |
| `paywall_view` | Records the Fernly paywall view product milestone. | Emitted by the existing paywall view application flow. | premium_status:string; source:string | `af_content_view` | high | yes |
| `photo_capture` | Records the Fernly photo capture product milestone. | Emitted by the existing photo capture application flow. | mode:string; reason:string; result:string | same name | none | no |
| `photo_pick` | Records the Fernly photo pick product milestone. | Emitted by the existing photo pick application flow. | mode:string; reason:string; result:string | same name | none | no |
| `plan_select` | Records the Fernly plan select product milestone. | Emitted by the existing plan select application flow. | plan:string; source:string | same name | none | no |
| `plant_delete_prompt` | Records the Fernly plant delete prompt product milestone. | Emitted by the existing plant delete prompt application flow. | source:string | same name | none | no |
| `plant_delete_result` | Records the Fernly plant delete result product milestone. | Emitted by the existing plant delete result application flow. | reason:string; result:string | same name | none | no |
| `plant_photo_replacement` | Records the Fernly plant photo replacement product milestone. | Emitted by the existing plant photo replacement application flow. | reason:string; result:string; source:string; surface:string | same name | none | no |
| `plant_save_result` | Records the Fernly plant save result product milestone. | Emitted by the existing plant save result application flow. | reason:string; result:string | same name | none | no |
| `plant_update_result` | Records the Fernly plant update result product milestone. | Emitted by the existing plant update result application flow. | changed_photo:boolean; reason:string; result:string | same name | none | no |
| `premium_cta` | Records the Fernly premium cta product milestone. | Emitted by the existing premium cta application flow. | reason:string; source:string | same name | none | no |
| `purchase_result` | Records the Fernly purchase result product milestone. | Emitted by the existing purchase result application flow. | plan:string; result:string; source:string | same name | high | yes |
| `purchase_start` | Records the Fernly purchase start product milestone. | Emitted by the existing purchase start application flow. | plan:string; source:string; trial_eligible:boolean | `af_initiated_checkout` | high | yes |
| `restore_result` | Records the Fernly restore result product milestone. | Emitted by the existing restore result application flow. | result:string; source:string | same name | none | no |
| `restore_start` | Records the Fernly restore start product milestone. | Emitted by the existing restore start application flow. | source:string | same name | none | no |
| `scan_again` | Records the Fernly scan again product milestone. | Emitted by the existing scan again application flow. | from_step:string; mode:string | same name | none | no |
| `scan_mode_change` | Records the Fernly scan mode change product milestone. | Emitted by the existing scan mode change application flow. | from_mode:string; source:string; to_mode:string | same name | none | no |
| `scan_submit` | Records the Fernly scan submit product milestone. | Emitted by the existing scan submit application flow. | has_plant_context:boolean; mode:string | same name | none | no |
| `sign_in_cancel` | Records the Fernly sign in cancel product milestone. | Emitted by the existing sign in cancel application flow. | provider:string | same name | none | no |
| `sign_in_failure` | Records the Fernly sign in failure product milestone. | Emitted by the existing sign in failure application flow. | provider:string; reason:string | same name | none | no |
| `permanent_account_created` | Records the Fernly permanent account created product milestone. | Emitted by the existing permanent account created application flow. | provider:string | `af_complete_registration` | high | yes |
| `returning_sign_in` | Records the Fernly returning sign in product milestone. | Emitted by the existing returning sign in application flow. | provider:string | `af_login` | high | yes |
| `sign_in_result` | Records the Fernly sign in result product milestone. | Emitted by the existing sign in result application flow. | provider:string; result:string | same name | none | no |
| `sign_in_tap` | Records the Fernly sign in tap product milestone. | Emitted by the existing sign in tap application flow. | provider:string | same name | none | no |
| `sign_out` | Records the Fernly sign out product milestone. | Emitted by the existing sign out application flow. | result:string | same name | none | no |
| `task_interval_update` | Records the Fernly task interval update product milestone. | Emitted by the existing task interval update application flow. | interval_days:number; reason:string; result:string; task_type:string | same name | none | no |
| `task_toggle` | Records the Fernly task toggle product milestone. | Emitted by the existing task toggle application flow. | enabled:boolean; reason:string; result:string; task_type:string | same name | none | no |
| `today_task_complete` | Records the Fernly today task complete product milestone. | Emitted by the existing today task complete application flow. | reason:string; result:string; source:string; task_type:string | same name | none | no |
| `ui_tap` | Records the Fernly ui tap product milestone. | Emitted by the existing ui tap application flow. | control_name:string; reason:string; source:string; surface:string | same name | none | no |
| `weather_location_remove` | Records the Fernly weather location remove product milestone. | Emitted by the existing weather location remove application flow. | result:string | same name | none | no |
| `weather_location_set` | Records the Fernly weather location set product milestone. | Emitted by the existing weather location set application flow. | reason:string; result:string; source:string | same name | none | no |
| `weather_tip_action` | Records the Fernly weather tip action product milestone. | Emitted by the existing weather tip action application flow. | action_kind:string; days:number; result:string | same name | none | no |

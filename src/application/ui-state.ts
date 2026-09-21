import { z } from 'zod';
const coordinate=z.number().finite().min(-10000).max(10000);
export const PointSchema=z.object({x:coordinate,y:coordinate}).strict();
export const TabletopSchema=z.object({
 accessibility:z.object({fontSize:z.union([z.literal(100),z.literal(115),z.literal(130)]),reducedMotion:z.boolean()}).strict().optional(),
 positions:z.record(z.string(),PointSchema),
 camera:z.object({x:coordinate,y:coordinate,zoom:z.number().finite().min(.45).max(1.5)}).strict(),
 collected:z.array(z.string()).max(10000),seenEvents:z.array(z.string()).max(10000),introductionDismissed:z.boolean(),
 layoutVersion:z.number().int().min(1).max(20).optional()
}).strict();
export type Point=z.infer<typeof PointSchema>;
export type TabletopState=z.infer<typeof TabletopSchema>;
export const UiSaveSchema=z.object({tab:z.string(),tabletop:TabletopSchema.optional()}).strict();
export type UiSaveState=z.infer<typeof UiSaveSchema>;
export const freshTabletop=():TabletopState=>({positions:{},camera:{x:0,y:0,zoom:1},collected:[],seenEvents:[],introductionDismissed:false});

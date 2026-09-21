import {z} from 'zod';
const n=z.number().int().nonnegative();
export const DomainSchema=z.enum(['alchemy','craft','practice']);
export type ResearchDomain=z.infer<typeof DomainSchema>;
export const InputSchema=z.object({id:z.string(),quantity:n.positive().max(99)}).strict();
export const SetupSchema=z.object({domain:DomainSchema,inputs:z.array(InputSchema).max(12),step:z.enum(['gentle','reverse','steady']),intensity:z.enum(['low','high'])}).strict();
export type ResearchSetup=z.infer<typeof SetupSchema>;
export const RuleSchema=z.object({domain:DomainSchema,material:z.string(),step:SetupSchema.shape.step,weights:z.array(n).length(4)}).strict();
export const EvidenceSchema=z.object({id:z.string(),journey:z.string(),domain:DomainSchema,scope:z.enum(['universal','journey']),status:z.enum(['rumor','explained','observed','verified']),source:z.string(),text:z.string(),tick:n,setup:z.string().optional()}).strict();
export const ResearchSchema=z.object({version:z.literal(1),journey:z.string(),seed:z.string(),rules:z.record(z.string(),RuleSchema),counter:n,randomCounter:n,injury:z.boolean(),
 evidence:z.array(EvidenceSchema),records:z.array(z.object({id:z.string(),journey:z.string(),setup:SetupSchema,outcome:z.string(),text:z.string(),tick:n,cost:n}).strict()),
 action:z.object({id:z.string(),kind:z.enum(['assessment','experiment','rumor','explain','gather','recover','observe','introspect']),domain:DomainSchema,setup:SetupSchema,startedTick:n,dueTick:n,outcome:z.string(),text:z.string(),cost:n}).strict().nullable(),
 warning:SetupSchema.nullable(),learned:z.array(z.string())}).strict();
export type Research=z.infer<typeof ResearchSchema>;
export const EntrySchema=z.object({instanceId:z.string().optional(),ref:z.enum(['kind','instance']),id:z.string(),name:z.string(),quantity:n.positive().max(99),journey:z.string().optional()}).strict();
export const CollectionSchema=z.object({id:z.string(),name:z.string().min(1).max(80),notes:z.string().max(2000),tags:z.array(z.string().max(40)).max(20),pinned:z.boolean(),order:n,version:n.positive(),entries:z.array(EntrySchema).min(1).max(40),setup:SetupSchema.optional(),journey:z.string(),history:z.array(z.object({version:n,journey:z.string(),signature:z.string()}).strict())}).strict();
export type Collection=z.infer<typeof CollectionSchema>;
export const NotebookSchema=z.object({version:z.literal(1),archive:ResearchSchema.shape.records.optional(),fixed:z.array(z.string()),collections:z.array(CollectionSchema).max(500)}).strict();
export type Notebook=z.infer<typeof NotebookSchema>;
export const freshNotebook=():Notebook=>({version:1,fixed:[],collections:[]});
export type ResearchCommand={type:'Research';operation:'enable'|'gather'|'rumor'|'explain'|'experiment'|'stop'|'continue'|'recover'|'observe'|'introspect'|'apply';domain:ResearchDomain;setup?:ResearchSetup;item?:string};

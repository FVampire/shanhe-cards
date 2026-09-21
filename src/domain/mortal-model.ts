import { z } from 'zod';
const n=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const origins=['traveller','herbalist','artisan','scribe','musician'] as const;
export const PersonSchema=z.object({
 id:z.string(),name:z.string(),role:z.string(),origin:z.enum(['resident','visitor','background']),enteredWorldAt:n,entryReason:z.string(),birthAt:z.number().int(),
 anchors:z.array(z.string()).min(3),appearance:z.string(),skill:n,goal:z.string(),location:z.string(),worldStatus:z.enum(['local','travelling','retired','missing','dead']),
 knownStatus:z.string(),contact:z.string(),simulationTier:z.enum(['L0','L1','L2','A']),retentionClass:z.enum(['ordinary','important']),
 lastSeen:n,departAt:n.nullable(),returnAt:n.nullable(),encounters:n,memories:z.array(z.string()).max(8),keyMemories:z.array(z.string()),
 pins:z.array(z.object({pinReason:z.string(),ownerId:z.string(),minimumTier:z.enum(['L1','L2','A']),releaseCondition:z.string()}).strict()),
 policy:z.enum(['immediate','timed','event','permanent'])
}).strict();
export type Person=z.infer<typeof PersonSchema>;
export const StackVerbSchema=z.enum(['study','talk','create','work','cultivate','travel']);
export type StackVerb=z.infer<typeof StackVerbSchema>;
export const StackCardSchema=z.object({id:z.string(),name:z.string(),kind:z.enum(['entity','location','intent','work','insight','event']),aspects:z.array(z.string()),description:z.string(),art:z.string(),subtitle:z.string(),color:z.string()}).strict();
export type StackCard=z.infer<typeof StackCardSchema>;
export const StackRunSchema=z.object({id:z.string(),actionId:z.string(),choice:z.string(),verb:StackVerbSchema,bindings:z.record(z.string(),z.string()),startedTick:n,dueTick:n,state:z.enum(['running','completed','cancelled']),collected:z.boolean(),inputs:z.array(StackCardSchema),outputs:z.array(StackCardSchema),beforeIds:z.array(z.string()),name:z.string(),description:z.string(),cost:n,reward:n,summary:z.string()}).strict();
export const MortalSchema=z.object({
 discoveries:z.object({verbs:z.array(StackVerbSchema),places:z.array(z.string())}).strict().optional(),
 cardRuns:z.record(z.string(),StackRunSchema).optional(),
 relationships:z.record(z.string(),z.object({personId:z.string(),kind:z.enum(['acquaintance','colleague','guide']),trust:z.number().int().min(-100).max(100),facts:z.array(z.string()).max(12)}).strict()),
 assets:z.record(z.string(),z.object({id:z.string(),kind:z.enum(['item','method','clue','commitment','work']),name:z.string(),ownerId:z.string(),source:z.string(),quantity:n,location:z.string(),status:z.enum(['available','reserved','consumed','returned'])}).strict()),
 ledger:z.array(z.object({id:z.string(),tick:n,from:z.string(),to:z.string(),amount:n,reason:z.string()}).strict()),
 mode:z.enum(['chapter','legacy']),created:z.boolean(),origin:z.enum(origins),talent:z.enum(['steady','observant','focused']),focus:z.enum(['life','work','path']),
 foodDays:n,paidUntil:n,lastChargedDay:n,reliefDay:z.number().int(),skills:z.record(z.string(),n),flags:z.array(z.string()),
 stages:z.record(z.string(),n),choices:z.record(z.string(),z.string()),people:z.record(z.string(),PersonSchema),generation:n,
 encounters:z.record(z.string(),z.string()),population:z.object({residents:n,embodied:n,visitors:n}).strict(),
 contracts:z.record(z.string(),z.object({id:z.string(),personId:z.string().nullable(),kind:z.string(),state:z.enum(['active','completed','cancelled','expired']),escrow:n,deposit:n,dueTick:n,receipt:z.string().nullable()}).strict()),
 messages:z.record(z.string(),z.object({id:z.string(),personId:z.string(),dueTick:n,state:z.enum(['travelling','delivered','returned']),text:z.string()}).strict()),
 task:z.object({id:z.string(),actionId:z.string(),choice:z.string(),startedTick:n,dueTick:n,personIds:z.array(z.string()),cost:n,contractId:z.string().nullable()}).strict().nullable(),
 method:z.string().nullable(),channel:z.string().nullable(),understanding:n,practice:n,corrected:z.boolean(),applied:z.boolean(),
 bank:n,workDay:z.number().int(),workCount:n,plan:n,planStopFatigue:n,completed:z.boolean(),
 shortEvents:z.record(z.string(),z.object({id:z.string(),state:z.enum(['open','resolved']),choice:z.string().nullable(),personId:z.string().nullable(),createdTick:n}).strict())
}).strict();
export type Mortal=z.infer<typeof MortalSchema>;
export function freshMortal(mode:'chapter'|'legacy'='chapter'):Mortal{return {relationships:{},assets:{},ledger:[],mode,created:mode==='legacy',origin:'traveller',talent:'steady',focus:'life',foodDays:2,paidUntil:0,lastChargedDay:0,reliefDay:-7,skills:{medicine:0,craft:0,scholar:0,music:0},flags:[],stages:{},choices:{},people:{},generation:0,encounters:{},population:{residents:180,embodied:0,visitors:0},contracts:{},messages:{},task:null,method:null,channel:null,understanding:0,practice:0,corrected:false,applied:false,bank:240,workDay:-1,workCount:0,plan:0,planStopFatigue:65,completed:false,shortEvents:{}};}
export type MortalCommand=
 | {type:'CreateMortal';name:string;origin:typeof origins[number];talent:'steady'|'observant'|'focused';acquaintance:boolean}
 | {type:'MortalAction';actionId:string;choice:string}
 | {type:'MortalStack';verb:StackVerb;bindings:Record<string,string>}
 | {type:'MortalCollect';runId:string}
 | {type:'CancelMortal'}
 | {type:'MortalFocus';focus:'life'|'work'|'path'}
 | {type:'MortalContact';personId:string;operation:'bookmark'|'letter'|'meet'}
 | {type:'MortalPlan';days:number;stopFatigue:number}
 | {type:'MortalEvent';eventId:string;choice:'act'|'decline'};

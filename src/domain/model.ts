import {ResearchSchema,type ResearchCommand} from './research-model';
import { MortalSchema, type MortalCommand } from './mortal-model';
import { z } from 'zod';
export const int = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const recordInt = z.record(z.string(), int);
export const EntitySchema = z.object({
 id:z.string(), kind:z.enum(['character','item','facility']), definitionId:z.string(), name:z.string(),
 tags:z.array(z.string()), location:z.string().nullable(), containerId:z.string().nullable(), ownerId:z.string(),
 quantity:int, description:z.string(), art:z.string(),
 skills:recordInt, knowledge:z.record(z.string(),z.enum(['acquired','understood','mastered'])),
 professions:recordInt, health:int.max(100), fatigue:int.max(100), ageMinutes:int, longevityDays:int,
 willing:z.boolean(), active:z.boolean()
}).strict();
export type Entity = z.infer<typeof EntitySchema>;
export const ReservationSchema = z.object({id:z.string(),projectId:z.string(),resourceId:z.string(),quantity:int.positive(),mode:z.enum(['exclusive','quantity'])}).strict();
export const ProjectSchema=z.object({
 id:z.string(),definitionId:z.string(),boundSlots:z.record(z.string(),z.string()),state:z.enum(['running','completed','cancelled','interrupted']),
 startedTick:int,dueTick:int,generation:int,spent:z.array(z.string()),delegated:z.boolean(),receipt:z.string().nullable()
}).strict();
const EventSchema=z.object({id:z.string(),kind:z.string(),title:z.string(),text:z.string(),createdTick:int,expiresTick:int,settled:z.boolean(),choice:z.string().nullable(),major:z.boolean()}).strict();
const RollSchema=z.object({key:z.string(),kind:z.enum(['omen','special_effect']),occurrenceId:z.string(),subjectId:z.string(),probabilityPpm:int.max(1000000),sampledPpm:int.max(999999),succeeded:z.boolean(),tick:int}).strict();
export const WorldSchema=z.object({
 research:ResearchSchema.nullable().optional(),mortal:MortalSchema,worldId:z.string(),seed:z.string(),revision:int,tick:int,rulesVersion:z.literal('2.0.0'),contentVersion:z.literal('0.2.0'),randomVersion:z.literal('keyed-v1'),
 entities:z.record(z.string(),EntitySchema),projects:z.record(z.string(),ProjectSchema),reservations:z.record(z.string(),ReservationSchema),
 events:z.record(z.string(),EventSchema),rolls:z.record(z.string(),RollSchema),receipts:z.record(z.string(),z.string()),
 commandReceipts:z.record(z.string(),z.object({ok:z.literal(true),revision:int}).strict()),
 schedule:z.array(z.object({id:z.string(),dueTick:int,phase:int,sourceId:z.string(),generation:int}).strict()),
 facts:z.record(z.string(),z.object({type:z.string(),subjectId:z.string(),location:z.string(),source:z.string(),revision:int,expiresTick:int}).strict()),
 knowledge:z.array(z.object({factId:z.string(),observerId:z.string(),source:z.string()}).strict()),
 reputation:recordInt,relations:recordInt,works:z.array(z.object({id:z.string(),authorId:z.string(),title:z.string(),topic:z.string(),tick:int}).strict()),
 insights:z.array(z.object({id:z.string(),subjectId:z.string(),question:z.string(),understanding:z.string(),source:z.string()}).strict()),
 consents:z.record(z.string(),z.object({uses:int,expiresTick:int}).strict()),
 money:int,market:z.object({money:int,herbs:int,demand:int}).strict(),
 contract:z.object({escrow:int,expiresTick:int,state:z.enum(['none','accepted','completed','expired','declined'])}).strict(),
 organization:z.object({money:int,authorized:z.boolean(),proxy:z.boolean(),policy:z.enum(['careful','productive']),delegation:z.boolean(),budget:int,cycles:int,blocked:z.string().nullable()}).strict(),
 counters:recordInt,log:z.array(z.object({id:z.string(),tick:int,text:z.string(),kind:z.enum(['story','success','warning'])}).strict())
}).strict();
export type World=z.infer<typeof WorldSchema>;
export type Project=z.infer<typeof ProjectSchema>;
export type Reservation=z.infer<typeof ReservationSchema>;
export type EventInstance=z.infer<typeof EventSchema>;
export type Command= ResearchCommand | MortalCommand
 | {type:'StartAction';actionId:string;bindings:Record<string,string>}
 | {type:'CancelAction';projectId:string}
 | {type:'ChooseEventOption';eventId:string;option:string}
 | {type:'AdvanceProfession';professionId:string;targetLevel:number}
 | {type:'AssignDelegate';enabled:boolean;proxy:boolean;budget:number}
 | {type:'SetPolicy';policy:'careful'|'productive'}
 | {type:'TransferItem';direction:'to_org'|'from_org';quantity:number}
 | {type:'BuyHerbs';quantity:number}
 | {type:'Investigate'}
 | {type:'Encounter';choice:'withdraw'|'negotiate'|'hire'|'endure'};
export type Envelope={commandId:string;expectedRevision:number;actorId:string;payload:Command};
export type Result={ok:true;revision:number}|{ok:false;code:string;message:string};
export const PLAYER='character.learner';
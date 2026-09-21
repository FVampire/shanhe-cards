import {it,expect} from 'vitest';
import {createWorld} from '../src/domain/world';
import {mortalCommand,cancelMortal} from '../src/domain/mortal';
import {advanceWorld} from '../src/domain/engine';
import {knownVerbs,knownPlaces,discoverFromExperience,allVerbs} from '../src/domain/mortal-discovery';
import {mortalDeck,resolveMortalStack} from '../src/domain/mortal-cards';
import {PLAYER} from '../src/domain/model';
import {envelope,parseSave} from '../src/infrastructure/save';
function fresh(){const w=createWorld();mortalCommand(w,{type:'CreateMortal',name:'青禾',origin:'traveller',talent:'steady',acquaintance:false});return w;}
it('新档只认识眼前的地方和行游，取消与预览不解锁操作',()=>{const w=fresh();expect(knownVerbs(w)).toEqual(['travel']);expect(knownPlaces(w)).toEqual(['location.market']);expect(mortalDeck(w).filter(c=>c.kind==='location')).toHaveLength(1);expect(resolveMortalStack(w,'travel',{actor:PLAYER,focus:'location.temple'})).toBeNull();mortalCommand(w,{type:'MortalStack',verb:'travel',bindings:{actor:PLAYER,focus:'thread.CH01.0'}});cancelMortal(w);expect(knownVerbs(w)).toEqual(['travel']);});
it('完成告示后发现交游、谋生和客舍，存档保留发现',()=>{let w=fresh();mortalCommand(w,{type:'MortalStack',verb:'travel',bindings:{actor:PLAYER,focus:'thread.CH01.0'}});w=advanceWorld(w,w.mortal.task!.dueTick);expect(knownVerbs(w)).toEqual(['travel','talk','work']);expect(knownPlaces(w)).toEqual(['location.market','location.inn']);expect(mortalDeck(w).some(c=>c.id==='intent.careful')).toBe(true);expect(parseSave(envelope(w)).world.mortal.discoveries).toEqual(w.mortal.discoveries);});
it('研习与创作来自不同经历，离开地点后不会重新上锁',()=>{const w=fresh();w.entities[PLAYER].location='location.workshop';expect(discoverFromExperience(w)).toContain('study');expect(knownVerbs(w)).not.toContain('create');w.mortal.stages.CH04=1;expect(discoverFromExperience(w)).toContain('create');w.entities[PLAYER].location='location.market';discoverFromExperience(w);expect(knownVerbs(w)).toEqual(['travel','study','create']);});
it('旧档无发现字段时保留原有全部入口',()=>{const w=fresh();delete w.mortal.discoveries;expect(knownVerbs(w)).toEqual(allVerbs);expect(knownPlaces(w)).toHaveLength(10);expect(parseSave(envelope(w)).world).toEqual(w);});

import { LearningMomentId } from '../domain/sim/flightEducation';

export const HUD_EXPLANATIONS={
 drag:'Drag is the atmosphere pushing against the rocket. It grows quickly with speed and wastes energy as heat.',
 maxQ:'Max-Q is the moment of greatest air pressure on the rocket. Too much can damage the structure.',
 twr:'Thrust-to-weight ratio compares engine push with the rocket’s weight. Above 1 means it can rise.',
 orbit:'Orbit means moving sideways fast enough that the rocket keeps falling around Earth instead of hitting it.',
 apoapsis:'Apoapsis is the highest point of the predicted orbit. Periapsis is the lowest point.',
} as const;

export const LEARNING_MOMENTS:Record<LearningMomentId,{title:string;text:string}>={
 drag:{title:'The atmosphere is pushing back',text:'Drag is slowing the rocket and turning some flight energy into heat. Climb smoothly before building most of your sideways speed.'},
 'max-q':{title:'You passed Max-Q',text:'The rocket has passed its greatest aerodynamic stress. As the air thins, it can safely accelerate harder.'},
 staging:{title:'A stage separated',text:'The empty tanks were dropped, so the remaining engines no longer need to accelerate that dead mass.'},
 orbit:{title:'You achieved orbit',text:'You’re moving at about 7.8 km/s—so fast that you keep falling around Earth instead of into it.'},
};

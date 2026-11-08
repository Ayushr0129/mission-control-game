import 'package:flutter/material.dart';
import 'art.dart';
class StartupScreen extends StatefulWidget {
 const StartupScreen({super.key});
 @override State<StartupScreen> createState()=>_StartupScreenState();
}
class _StartupScreenState extends State<StartupScreen> with SingleTickerProviderStateMixin {
 late final AnimationController animation=AnimationController(vsync:this,duration:const Duration(seconds:8))..repeat();
 @override void dispose(){animation.dispose();super.dispose();}
 @override Widget build(BuildContext context)=>MaterialApp(debugShowCheckedModeBanner:false,home:Scaffold(backgroundColor:ink,body:AnimatedBuilder(animation:animation,builder:(c,child)=>Stack(children:[Positioned.fill(child:Opacity(opacity:.3,child:CustomPaint(painter:SpaceArt(time:animation.value*8)))),Center(child:Column(mainAxisSize:MainAxisSize.min,children:[SizedBox(width:120,height:120,child:CustomPaint(painter:CraftArt(const ['core'],time:animation.value*8))),const SizedBox(height:22),const Text('MISSION\nCONTROL',textAlign:TextAlign.center,style:TextStyle(color:white,fontFamily:'SpaceGrotesk',fontSize:29,fontWeight:FontWeight.w600,letterSpacing:7,height:1.4)),const SizedBox(height:16),const Text('BEYOND THE LAUNCH',style:TextStyle(color:dim,fontFamily:'JetBrainsMono',fontSize:10,letterSpacing:3)),const SizedBox(height:40),const SizedBox(width:100,child:LinearProgressIndicator(color:cyan,backgroundColor:panel,minHeight:2))]))]))));
}

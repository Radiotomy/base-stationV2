import { Crown, User } from 'lucide-react';

export default function MaestroChatBubble({ role, text }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-muted' : 'bg-amber-500/20 border border-amber-500/40'}`}>
        {isUser ? <User className="w-3.5 h-3.5 text-muted-foreground" /> : <Crown className="w-3.5 h-3.5 text-amber-300" />}
      </div>
      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
        isUser ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'
      }`}>
        {text}
      </div>
    </div>
  );
}
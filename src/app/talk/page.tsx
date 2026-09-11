import type { Metadata } from "next";
import { TalkPlayer } from "./TalkPlayer";
import { loadIdentityTalkData } from "./identity/data";
import { loadMbtiTalkData } from "./mbti/data";

export const metadata: Metadata = {
  title: "如果 Token 会说话 — ZenMux Arena",
  description: "一场可以点击的研究演讲。身份的回声、市场的选择、回答的习惯。",
};

export default async function TalkPage() {
  // Only small pinned research artifacts cross this boundary. Live billing and
  // listing requests start inside their slides, never during cover rendering.
  const [identity, mbti] = await Promise.all([loadIdentityTalkData(), loadMbtiTalkData()]);
  return <TalkPlayer identity={identity} mbti={mbti} />;
}

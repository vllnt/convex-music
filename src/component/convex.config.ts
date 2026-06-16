import { defineComponent } from "convex/server";

const component = defineComponent("music");

// Official child components (response cache / retry / rate-limit) are added in
// the provider-fetch phase, e.g.:
// import rateLimiter from "@convex-dev/rate-limiter/convex.config";
// component.use(rateLimiter);

export default component;

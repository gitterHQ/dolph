-- As taken from http://redis.io/commands/INCR

local key = KEYS[1]
local ttl_window = ARGV[1]

local current = redis.call("incr", key)
local ttl;

if tonumber(current) == 1 then
  redis.call("expire", key, ttl_window)
  ttl = ttl_window
else
  ttl = redis.call("ttl", key)
end

return { current, ttl }
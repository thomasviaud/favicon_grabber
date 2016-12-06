###favicon-grabber

Allows you to get the favicon of any specified web domain (if it exists or is reachable).

**Running server**

`node index.js`

**Usage**

`curl -I http://localhost:8000/?domain=dashlane.com`

```
HTTP/1.1 200 OK
Content-Type: image/x-icon
...
```



Domain format suported : 

```
dashlane.com
wwww.dashlane.com
http://dashlane.com
http://www.dashlane.com
https://www.dashlane.com
```

**TO DO**

- TESTS !!
- Cache system
- Best resolution choice

**TO FIX**

- ContentType response adaptation

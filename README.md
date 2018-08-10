### Deleteing emty files

```
find *.webp -maxdepth 1 -type f -size +521c -a -size -523c -delete;
find *.jpeg -maxdepth 1 -type f -size +2946c -a -size -2948c -delete;
find *_t.jpeg -maxdepth 1 -type f -delete
```
